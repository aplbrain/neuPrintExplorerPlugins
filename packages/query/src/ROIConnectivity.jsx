/*
 * Supports simple, custom neo4j query.
 */
import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';

import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import InputLabel from '@material-ui/core/InputLabel';
import { withStyles } from '@material-ui/core/styles';

import ColorBox from './visualization/ColorBox';

const styles = theme => ({
  clickable: {
    cursor: 'pointer'
  },
  select: {
    fontFamily: theme.typography.fontFamily,
    margin: '0.5em 0 1em 0'
  }
});

const pluginName = 'ROIConnectivity';
const pluginAbbrev = 'rc';

// default color for max connection
const WEIGHTCOLOR = '255,100,100,';

class ROIConnectivity extends React.Component {
  static get details() {
    return {
      name: pluginName,
      displayName: 'ROI Connectivity',
      abbr: pluginAbbrev,
      description: 'Extract connectivity matrix for a dataset',
      visType: 'HeatMapTable'
    };
  }

  static fetchParameters(params) {
    const { dataset } = params;
    return {
      queryString: `/cached/roiconnectivity?dataset=${dataset}`,
      method: 'GET'
    };
  }

  static processResults(query, apiResponse, actions, submit) {
    const { squareSize } = query.visProps;
    const { pm: parameters } = query;
    const { rois } = parameters;

    const neuronsInRoisQuery = (inputRoi, outputRoi) => ({
      dataSet: parameters.dataset,
      parameters: {
        dataset: parameters.dataset,
        input_ROIs: [inputRoi],
        output_ROIs: [outputRoi]
      },
      visProps: { rowsPerPage: 25 },
      pluginCode: 'fn',
    });

    // get set of all rois included in this query, if we are filtering.
    // if not, the set is all values returned by the server.
    let roiNames = apiResponse.roi_names;
    if (rois) {
      roiNames = apiResponse.roi_names.filter((roi) => rois.includes(roi));
    }

    let maxWeight = 0;
    let maxCount = 0;

    // loop over to set weight color thresholds
    roiNames.forEach(input => {
      roiNames.forEach(output => {
        const connectionName = `${input}=>${output}`;
        const connectivityValue = apiResponse.weights[connectionName] ? apiResponse.weights[connectionName].weight : 0;
        const connectivityCount = apiResponse.weights[connectionName] ? apiResponse.weights[connectionName].count : 0;
        maxWeight = Math.max(connectivityValue, maxWeight);
        maxCount = Math.max(connectivityCount, maxCount);
      });
    });

    // make data table
    const data = [];
    roiNames.forEach(input => {
      const row = [];
      // set the row title
      row.push(input);

      // fill out the data blocks for each column
      roiNames.forEach(output => {
        const neuronsQuery = neuronsInRoisQuery(input, output);
        const connectionName = `${input}=>${output}`;
        const connectivityValue = apiResponse.weights[connectionName] ? apiResponse.weights[connectionName].weight : 0;
        const connectivityCount = apiResponse.weights[connectionName] ? apiResponse.weights[connectionName].count : 0;

        const scaleFactor =  Math.log(connectivityValue) / Math.log(maxWeight);
        const weightColor = `rgba(${WEIGHTCOLOR}${scaleFactor})`;
        row.push({
          value: (
            <button
              type="button"
              className="heatmapbutton"
              onClick={() => submit(neuronsQuery)}
            >
              <ColorBox
                margin={0}
                width={squareSize}
                height={squareSize}
                backgroundColor={weightColor}
                title=""
                key={connectionName}
                text={
                  <div>
                    <Typography>{Math.round(connectivityValue, 0)}</Typography>
                    <Typography variant="caption">{connectivityCount}</Typography>
                  </div>
                }
              />
            </button>
          ),
          sortBy: { rowValue: input, columeValue: output },
          csvValue: connectivityValue,
          uniqueId: connectionName
        });
      });
      data.push(row);
    });

    return {
      columns: ['', ...roiNames],
      data,
      debug: 'No cypher query for this plugin',
      title: 'ROI Connectivity (column: inputs, row: outputs)',
    };
  };

  constructor(props) {
    super(props);
    this.state = {
      rois: []
    };
  }

  processRequest = () => {
    const { dataSet, submit } = this.props;
    const { rois } = this.state;

    const query = {
      dataSet,
      visProps: { squareSize: 75 },
      plugin: pluginName,
      pluginCode: pluginAbbrev,
      parameters: {
        dataset: dataSet,
        rois
      },
    };
    submit(query);
    return query;
  };

  handleChangeROIs = selected => {
    const rois = selected.map(item => item.value);
    this.setState({ rois });
  };

  render() {
    const { isQuerying, availableROIs, classes } = this.props;
    const { rois } = this.state;

    const roiOptions = availableROIs.map(name => ({
      label: name,
      value: name
    }));

    const roiValue = rois.map(roi => ({
      label: roi,
      value: roi
    }));

    return (
      <div>
        <InputLabel htmlFor="select-multiple-chip">ROIs (optional)</InputLabel>
        <Select
          className={classes.select}
          isMulti
          value={roiValue}
          onChange={this.handleChangeROIs}
          options={roiOptions}
          closeMenuOnSelect={false}
        />
        <Button
          variant="contained"
          color="primary"
          disabled={isQuerying}
          onClick={this.processRequest}
        >
          Submit
        </Button>
        <br />
        <br />
        <Typography style={{ fontWeight: 'bold' }}>Description</Typography>
        <Typography variant="body2">
          Within each cell of the matrix, the top number represents connections from ROI X to ROI Y
          defined as the number of synapses from neurons that have inputs in X and outputs in Y. The
          number represents the number of outputs from these neurons in Y weighted by the proportion
          of inputs that are in X. The bottom number is the number of neurons with at least one
          input in X and one output in Y. In some cases, the bottom number can be larger than the
          top number if most of the neuron inputs are not in X.
        </Typography>
      </div>
    );
  }
}

ROIConnectivity.propTypes = {
  dataSet: PropTypes.string.isRequired,
  availableROIs: PropTypes.arrayOf(PropTypes.string).isRequired,
  classes: PropTypes.object.isRequired,
  isQuerying: PropTypes.bool.isRequired,
  submit: PropTypes.func.isRequired
};

export default withStyles(styles)(ROIConnectivity);
