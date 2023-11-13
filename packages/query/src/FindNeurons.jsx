/* eslint-disable prefer-destructuring */
import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Typography from '@material-ui/core/Typography';

import { ColorLegend } from '@neuprint/miniroiheatmap';
import NeuronInputField from './shared/NeuronInputField';
import AdvancedNeuronInput from './shared/AdvancedNeuronInput';
import NeuronFilterNew, {
  convertToCypher,
  thresholdCypher,
  statusCypher
} from './shared/NeuronFilterNew';
import BrainRegionInput from './shared/BrainRegionInput';
import {
  createSimpleConnectionQueryObject,
  generateRoiHeatMapAndBarGraph,
  generateMitoBarGraph,
  generateMitoByTypeBarGraph,
  getBodyIdForTable
} from './shared/pluginhelpers';

const styles = theme => ({
  select: {
    fontFamily: theme.typography.fontFamily,
    margin: '0.5em 0 1em 0'
  },
  clickable: {
    cursor: 'pointer'
  },
  regexWarning: {
    fontSize: '0.9em'
  },
  formControl: {
    marginBottom: '1em'
  }
});

// this should match the name of the file this plugin is stored in.
const pluginName = 'FindNeurons';
const pluginAbbrev = 'fn';

function rejectRowCheck(type, roiInfo, roisToCheck) {
  // if no ROIs were selected to filter, then return
  if (roisToCheck.length === 0) {
    return false;
  }
  // if roi is in any of the check locations then return false
  for (let i = 0; i < roisToCheck.length; i += 1) {
    const roi = roisToCheck[i];
    if (roiInfo[roi][type] > 0) {
      return false;
    }
  }
  return true;
}

function findMinSortValue(row, inputROIs, outputROIs) {
  const counts = [];
  const roiInfoObject = JSON.parse(row[4]);
  // get pre for all outputs
  outputROIs.forEach(roi => counts.push(roiInfoObject[roi].pre));
  // get post for all inputs
  inputROIs.forEach(roi => counts.push(roiInfoObject[roi].post));
  // return min value
  return Math.min(...counts);
}

function neuronConditionCypher(neuronName, neuronId, useContains) {
  const regstr = useContains ? "=" : "=~"

  if (neuronName && neuronName !== "") {
    return `(neuron.type${regstr}"${neuronName}" OR neuron.instance${regstr}"${neuronName}")`;
  }

  if (neuronId) {
    return `neuron.bodyId = ${neuronId}`;
  }

  return "";
}

function roiCypher(inputROIs=[], outputROIs=[]) {
  const rois = [...inputROIs, ...outputROIs];
  if (rois.length === 0) {
    return '';
  }
  return `${rois.map(roi => `(neuron.\`${roi}\` = true)`).join(' AND ')}`;
}

export class FindNeurons extends React.Component {
  static get details() {
    return {
      name: pluginName,
      displayName: 'Find neurons',
      abbr: pluginAbbrev,
      category: 'top-level',
      description: 'Find neurons that have inputs or outputs in selected brain regions',
      visType: 'SimpleTable'
    };
  }

  static fetchParameters(params) {
    // replacing the caned cypher query in neuprintHTTP with a custom query that we
    // can modify in the client, as it takes less development effort to release a new
    // client without having to release a new server as well.
    const neuronSegment = params.all_segments ? 'Segment' : 'Neuron';

    // foreach item in the filters, check if it is an array or a string. if it is
    // a string, convert it to an array and then run it through the cypher
    // conversion function
    const filters = params.filters ? Object.entries(params.filters).map(([filterName, value]) => {
      return convertToCypher(filterName, Array.isArray(value) ? value : [value])
    }) : [];
    const conditions = [
      neuronConditionCypher(params.neuron_name, params.neuron_id, params.enable_contains),
      thresholdCypher('pre', params.pre),
      thresholdCypher('post', params.post),
      statusCypher(params.statuses),
      roiCypher(params.input_ROIs, params.output_ROIs),
      ...filters
    ].filter(condition => condition !== '').join(' AND ');

    const hasConditions = conditions.length > 0 ? 'WHERE' : '';

    const cypherQuery = `MATCH (m:Meta) WITH m.superLevelRois AS rois MATCH (neuron :${neuronSegment}) ${hasConditions} ${conditions} RETURN neuron, rois ORDER BY neuron.bodyId`;

    return {
      cypherQuery,
      queryString: '/custom/custom?np_explorer=find_neurons'
      // queryString: '/npexplorer/findneurons'
    };
  }

  static clipboardCallback = apiResponse => columns => {
    const csv = apiResponse.result.data
      .map(row => {
        const filteredRow = columns
          .map((column, index) => {
            if (!column) {
              return null;
            }

            if (row[index] && typeof row[index] === 'object') {
              return row[index].sortBy || row[index].value;
            }

            if (!row[index]) {
              return '';
            }

            return row[index];
          })
          .filter(item => item !== null)
          .join(',');
        return filteredRow;
      })
      .join('\n');
    return csv;
  };

  static processDownload(response) {
    const headers = ['id', 'instance', 'notes', 'type', 'status', 'inputs (#post)', 'outputs (#pre)'];

    const { input_ROIs: inputROIs = [], output_ROIs: outputROIs = [] } = response.params.pm;
    const rois = inputROIs && outputROIs ? [...new Set(inputROIs.concat(outputROIs))] : [];
    if (rois.length > 0) {
      rois.forEach(roi => {
        headers.push(`${roi} #post`);
        headers.push(`${roi} #pre`);
      });
    }

    headers.push('#voxels');

    const data = response.result.data
      .map(row => {
        const bodyId = row[0];
        const totalPre = row[6];
        const totalPost = row[7];
        const voxelCount = row[5];
        const roiInfoObject = JSON.parse(row[4]);
        const bodyName = row[1] || '';
        const bodyType = row[2] || '';

        // filter out the rows that don't have the selected inputs or outputs.
        if (rejectRowCheck('post', roiInfoObject, inputROIs)) {
          return null;
        }
        if (rejectRowCheck('pre', roiInfoObject, outputROIs)) {
          return null;
        }

        const converted = [
          bodyId,
          bodyName.replace(/[\n\r]/g, ''),
          row[9],
          bodyType,
          row[3],
          totalPost,
          totalPre
        ];
        // figure out roi counts.
        if (rois.length > 0) {
          rois.forEach(roi => {
            converted.push(roiInfoObject[roi].post);
            converted.push(roiInfoObject[roi].pre);
          });
        }

        // add voxel count as the last column
        converted.push(voxelCount);

        return converted;
      })
      .filter(row => row !== null);
    data.unshift(headers);
    return data;
  }

  static getColumnHeaders(query, defaultDatasetColumns) {
    const { input_ROIs: inputROIs = [], output_ROIs: outputROIs = [] } = query.pm;
    const rois = inputROIs && outputROIs ? [...new Set(inputROIs.concat(outputROIs))] : [];

    const columnIds = [
      { name: 'id', id: "bodyId", status: true},
      { name: 'instance', id: "instance", status: false },
      { name: 'type', id: "type", status: true },
      { name: 'predicted nt', id: "predictedNt", status: false },
      { name: 'status', id: "status", status: true },
      { name: 'inputs (#post)', id: "post", status: true },
      { name: 'outputs (#pre)', id: "pre", status: true }
    ];

    if (rois.length > 0) {
      rois.forEach(roi => {
        columnIds.push({ name: `${roi} #post`, id: `roiPost${roi}`, status: true });
        columnIds.push({ name: `${roi} #pre`, id: `roiPre${roi}`, status: true });
      });
    }
    columnIds.push(
      { name: '#voxels', id: "size", status: false },
      { name: 'brain region breakdown', id: "roiBarGraph", status: true },
      { name: 'brain region heatmap', id: "roiHeatMap", status: false },
      { name: 'mitochondria', id: "mitoTotal", status: false },
      { name: 'mitochondria by brain region', id: "mitoByRegion", status: false },
      { name: 'top mitochondria by type', id: "mitoByType", status: false },
      { name: 'class', id: "class", status: false },
      { name: 'group', id: "group", status: false },
      /* The below attributes are being removed from the default list and need
      to be applied to individual datasets. This can be done by setting the
      n.neuronColumns meta information to add new columns or override the
      ones that are listed here. Eg, for some datasets, you might want to
      turn off one of the columns by default.
       */
      /* { name: 'entry nerve', id: "entryNerve", status: false },
      { name: 'exit nerve', id: "exitNerve", status: false },
      { name: 'hemilineage', id: "hemilineage", status: false },
      { name: 'long tract', id: "longTract", status: false },
      { name: 'subclass', id: "subclass", status: false },
      { name: 'synonyms', id: "synonyms", status: false },
      { name: 'systematic type', id: "systematicType", status: false },
      { name: 'origin', id: "origin", status: false },
      { name: 'target', id: "target", status: false },
      { name: 'soma neuromere', id: "somaNeuromere", status: false },
      { name: 'soma side', id: "somaSide", status: false },
      { name: 'birth time', id: "birthtime", status: false },
      { name: 'serial', id: "serial", status: false },
      { name: 'serial motif', id: "serialMotif", status: false },
      { name: 'modality', id: "modality", status: false },
      { name: 'notes', id: "notes", status: false }, */
    );

    // look for neuronColumns and neuronColumns visible in the
    // dataset Meta
    // if present, add the columns to the returned array.
    // Probably need to merge the columns from the Meta data
    // as they don't cover everything that we want to display.
    if (defaultDatasetColumns && query.ds in defaultDatasetColumns) {
      const serverDefaultColumns = defaultDatasetColumns[query.ds];
      const mergedColumns = columnIds.map(column => {
        return serverDefaultColumns.find(test => test.id === column.id) || column
      }).concat(serverDefaultColumns.filter(test =>  !columnIds.find( baseCol => baseCol.id === test.id)));
      return mergedColumns;
    }

    return columnIds;
  }

  // this function will parse the results from the query to the
  // Neo4j server and place them in the correct format for the
  // visualization plugin.
  static processResults({ query, apiResponse, actions, submitFunc, defaultColumns }) {
    const { input_ROIs: inputROIs = [], output_ROIs: outputROIs = [] } = query.pm;

    const colHeaders = this.getColumnHeaders(query, defaultColumns);

    const data = apiResponse.data.map(row => {
      // if we get everything back as a JSON object, then we should be able to sort
      // and modify the response based on the colHeaders array

      const entry = row[0];
      const roiList = row[1];
      // make sure none is added to the rois list.
      roiList.push('None');
      const roiInfoObject = JSON.parse(entry.roiInfo);
      // for each row check to see if the row should be rejected
      if (rejectRowCheck('post', roiInfoObject, inputROIs)) {
        return null;
      }
      if (rejectRowCheck('pre', roiInfoObject, outputROIs)) {
        return null;
      }

      const { heatMap, barGraph } = generateRoiHeatMapAndBarGraph(
        roiInfoObject,
        roiList,
        entry.pre,
        entry.post
      );

      const filteredROIs = {};
      Object.keys(roiInfoObject).forEach(roi => {
        if (roiList.find(element => element === roi)) {
          filteredROIs[roi] = roiInfoObject[roi];
        }
      });
      const mitoTotal = Object.values(filteredROIs).reduce((i, info) => {
        if (info.mito) {
          return info.mito + i;
        }
          return i;
        }, 0);


      const converted = [];
      // loop over the colHeaders and look for the id/key in the JSON.
      colHeaders.forEach(header => {
        let colValue = entry[header.id] || '';
        // for certain headers we need to modify the returned results
        if (header.id === 'bodyId') {
          colValue = getBodyIdForTable(query.ds, entry[header.id], actions, {skeleton: true});
        }
        // if this is a type column, then check to see if there is a JSON string
        // If there is a JSON string with a value and an href attribute, then convert
        // it into a link on the page.
        if (header.id === 'type') {
          try {
            const parsedType = JSON.parse(row[0].type);
            if (!parsedType?.href) {
              throw Error('href missing for type');
            }
            if (!parsedType?.label) {
              throw Error('label missing for type');
            }
            const link = /^http/.test(parsedType.href)
              ? (<a href={parsedType.href}>{parsedType.label}</a>)
              : (<Link to={parsedType.href}>{parsedType.label}</Link>);


            colValue = {
              value: link,
              sortBy: parsedType.label,
            };
          } catch (error) {
            console.log(error);
            colValue = row[0].type;
          }
        }
        if (header.id === 'post') {
          const postQuery = createSimpleConnectionQueryObject({
            dataSet: query.ds,
            isPost: true,
            queryId: entry.bodyId
          });
          colValue = {
            value: entry.post,
            action: () => submitFunc(postQuery)
          };
        }
        if (header.id === 'pre') {
          const preQuery = createSimpleConnectionQueryObject({
            dataSet: query.ds,
            queryId: entry.bodyId
          });
          colValue = {
            value: entry.pre,
            action: () => submitFunc(preQuery)
          };
        }
        if (header.id === 'roiHeatMap') {
          colValue = heatMap;
        }
        if (header.id === 'roiBarGraph') {
          colValue = barGraph;
        }
        if (header.id === 'mitoTotal') {
          // TODO: this query object should be generated by the CellObjects plugin, so that
          // we aren't duplicating code here.
          const cypher = `MATCH(n :Cell {bodyId: ${entry.bodyId}}) -[]-> () -[]-> (m:Element) WHERE m.type="mitochondrion" RETURN ID(m), m.type, m`;
          const mitoQuery = {
            dataSet: query.ds,
            pluginCode: 'cos',
            pluginName: 'CellObjects',
            parameters: {
              dataset: query.ds,
              bodyId: entry.bodyId,
              cypherQuery: cypher
            }
          };
          colValue = {
            value: mitoTotal,
            action: () => submitFunc(mitoQuery)
          };
        }
        if (header.id === 'mitoByType') {
          colValue = generateMitoByTypeBarGraph(filteredROIs, mitoTotal);
        }
        if (header.id === 'mitoByRegion') {
          colValue = generateMitoBarGraph(filteredROIs, mitoTotal);
        }
        const postMatch = header.id.match(/^roiPost(.*)$/);
        if (postMatch) {
          colValue = '0';
          if (roiInfoObject[postMatch[1]]) {
            colValue = roiInfoObject[postMatch[1]].post || '0';
          }
        }
        const preMatch = header.id.match(/^roiPre(.*)$/);
        if (preMatch) {
          colValue = '0';
          if (roiInfoObject[preMatch[1]]) {
            colValue = roiInfoObject[preMatch[1]].pre || '0';
          }
        }

        converted.push(colValue);
      });
      return converted;
    })
    .filter(row => row !== null);

    // replace headers that need to have JSX and not just text.
    const columns = colHeaders.map(header => {
      if (header.id === 'roiHeatMap') {
        return (
          <div>
            roi heatmap <ColorLegend />
          </div>
        );
      }
      return header.name;
    });


    return {
      columns,
      data,
      debug: apiResponse.debug,
      title: `Neurons with inputs in [${inputROIs}] and outputs in [${outputROIs}]`
    };
  }

  constructor(props) {
    super(props);
    // set the default state for the query input.
    this.state = {
      limitNeurons: true,
      status: [],
      pre: 0,
      post: 0,
      neuronInstance: '',
      inputROIs: [],
      outputROIs: [],
      filters: {},
      useSuper: true,
      advancedSearch: JSON.parse(localStorage.getItem('neuprint_advanced_search')) || false
    };
  }

  // use this method to cleanup your form data, perform validation
  // and generate the query object.
  processRequest = () => {
    const { dataSet, submit, actions } = this.props;
    const {
      status,
      limitNeurons,
      pre,
      post,
      neuronInstance,
      neuronType,
      inputROIs,
      outputROIs,
      filters,
      advancedSearch
    } = this.state;

    const parameters = {
      dataset: dataSet,
      input_ROIs: inputROIs,
      output_ROIs: outputROIs,
      statuses: status,
      all_segments: !limitNeurons
    };

    if (pre > 0) {
      parameters.pre = pre;
    }

    if (post > 0) {
      parameters.post = post;
    }

    if (Object.keys(filters).length > 0) {
      parameters.filters = filters;
    }

    // if not using an advanced search then we want to query neo4j with
    // the CONTAINS search and not a regex search.
    if (!advancedSearch) {
      parameters.enable_contains = true;
    }

    // don't allow submission if there are no filters set.
    if (neuronInstance === '' && inputROIs.length === 0 && outputROIs.length === 0 && Object.keys(filters).length === 0) {
      actions.formError('Please apply at least one of the filters in the form.');
      return;
    }

    if (neuronInstance !== '') {
      if (/^\d+$/.test(neuronInstance)) {
        parameters.neuron_id = parseInt(neuronInstance, 10);
      } else {
        parameters.neuron_name = neuronInstance;
      }
    }

    if (neuronType !== '') {
      parameters.neuron_type = neuronType;
    }

        const query = {
      dataSet, // <string> for the data set selected
      plugin: pluginName, // <string> the name of this plugin.
      pluginCode: pluginAbbrev,
      parameters,
      visProps: {
        rowsPerPage: 25
      }
    };
    submit(query);
  };

  handleChangeROIsIn = selected => {
    let rois = [];
    if (selected) {
      rois = selected.map(item => item.value);
    }
    this.setState({ inputROIs: rois });
  };

  handleChangeROIsOut = selected => {
    let rois = [];
    if (selected) {
      rois = selected.map(item => item.value);
    }
    this.setState({ outputROIs: rois });
  };

  addNeuronInstance = neuronInstance => {
    this.setState({ neuronInstance });
  };

  addNeuronType = event => {
    const neuronType = event.target.value;
    this.setState({ neuronType });
  };

  loadNeuronFilters = params => {
    this.setState({
      status: params.status,
      pre: parseInt(params.pre, 10),
      post: parseInt(params.post, 10)
    });
  };

  loadNeuronFiltersNew = filters => {
    this.setState({
      filters
    });
  };



  toggleSuper = event => {
    // TODO: check to see if ROIs are valid. Remove if they are no longer valid.
    this.setState({ useSuper: !event.target.checked, inputROIs: [], outputROIs: [] });
  };

  toggleAdvanced = event => {
    localStorage.setItem('neuprint_advanced_search', event.target.checked);
    this.setState({ advancedSearch: event.target.checked, neuronInstance: '' });
  };

  // use this function to generate the form that will accept and
  // validate the variables for your Neo4j query.
  render() {
    const {
      classes,
      isQuerying,
      availableROIs,
      superROIs,
      roiInfo,
      dataSet,
      actions,
      neoServerSettings
    } = this.props;
    const {
      useSuper,
      neuronInstance = '',
      inputROIs = [],
      outputROIs = [],
      advancedSearch
    } = this.state;

    // decide to use super ROIs (default) or all ROIs
    const selectedROIs = useSuper ? superROIs : availableROIs;
    const inputValue = inputROIs.map(roi => ({
      label: roi,
      value: roi
    }));
    const outputValue = outputROIs.map(roi => ({
      label: roi,
      value: roi
    }));

    return (
      <div>
        {advancedSearch ? (
          <AdvancedNeuronInput
            onChange={this.addNeuronInstance}
            value={neuronInstance}
            dataSet={dataSet}
            handleSubmit={this.processRequest}
          />
        ) : (
          <NeuronInputField
            onChange={this.addNeuronInstance}
            value={neuronInstance}
            dataSet={dataSet}
            handleSubmit={this.processRequest}
          />
        )}
        <InputLabel htmlFor="select-multiple-chip">Input Brain Regions</InputLabel>
        <BrainRegionInput
          rois={selectedROIs}
          value={inputValue}
          roiInfo={roiInfo}
          onChange={this.handleChangeROIsIn}
        />
        <InputLabel htmlFor="select-multiple-chip">Output Brain Regions</InputLabel>
        <BrainRegionInput
          rois={selectedROIs}
          value={outputValue}
          roiInfo={roiInfo}
          onChange={this.handleChangeROIsOut}
        />
        <FormControl className={classes.formControl}>
          <FormControlLabel
            control={<Switch checked={!useSuper} onChange={this.toggleSuper} color="primary" />}
            label={
              <Typography variant="subtitle1" style={{ display: 'inline-flex' }}>
                Allow all brain regions
              </Typography>
            }
          />
        </FormControl>
        <FormControl className={classes.formControl}>
          <FormControlLabel
            control={
              <Switch checked={advancedSearch} onChange={this.toggleAdvanced} color="primary" />
            }
            label={
              <Typography variant="subtitle1" style={{ display: 'inline-flex' }}>
                Advanced input
              </Typography>
            }
          />
        </FormControl>
        <NeuronFilterNew
          callback={this.loadNeuronFiltersNew}
          datasetstr={dataSet}
          actions={actions}
          neoServer={neoServerSettings.get('neoServer')}
        />
        <Button
          disabled={isQuerying}
          color="primary"
          variant="contained"
          onClick={this.processRequest}
        >
          Submit
        </Button>
      </div>
    );
  }
}

// data that will be provided to your form. Use it to build
// inputs, selections and for validation.
FindNeurons.propTypes = {
  actions: PropTypes.object.isRequired,
  availableROIs: PropTypes.arrayOf(PropTypes.string).isRequired,
  superROIs: PropTypes.arrayOf(PropTypes.string).isRequired,
  roiInfo: PropTypes.object,
  dataSet: PropTypes.string.isRequired,
  classes: PropTypes.object.isRequired,
  submit: PropTypes.func.isRequired,
  isQuerying: PropTypes.bool.isRequired,
  neoServerSettings: PropTypes.object.isRequired
};

FindNeurons.defaultProps = {
  roiInfo: {}
};

export default withStyles(styles)(FindNeurons);
