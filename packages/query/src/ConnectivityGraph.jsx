import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';

import Button from '@material-ui/core/Button';
import FormControl from '@material-ui/core/FormControl';
import FormLabel from '@material-ui/core/FormLabel';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import TextField from '@material-ui/core/TextField';

const pluginName = 'ConnectivityGraph';
const pluginAbbrev = 'cg';

// TODO: add colors based on similar name?

const styles = theme => ({
  formControl: {
    marginBottom: theme.spacing.unit,
    marginTop: theme.spacing.unit,
    maxWidth: 400,
    display: 'block'
  },
  button: {
    display: 'block'
  },
  clickable: {
    cursor: 'pointer'
  }
});

class ConnectivityGraph extends React.Component {
  static get details() {
    return {
      name: pluginName,
      displayName: 'Connectivity graph',
      abbr: pluginAbbrev,
      description: 'View a graph displaying connectivity between neurons.',
      visType: 'Graph'
    };
  }

  static processResults(query, apiResponse) {
    const { includeAutapses, minWeight, bodyIds } = query.pm;

    let maxObsWeight;
    let minObsWeight;

    const edges = [];
    const bodyIdToName = {};

    apiResponse.data.forEach(row => {
      const start = row[0];
      const end = row[1];
      const weight = row[2];
      const startName = row[3];
      const endName = row[4];

      if (maxObsWeight === undefined || maxObsWeight < weight) {
        maxObsWeight = weight;
      }
      if (minObsWeight === undefined || minObsWeight > weight) {
        minObsWeight = weight;
      }
      if ((includeAutapses || start !== end) && weight > minWeight) {
        edges.push({
          data: { source: start, target: end, label: weight, classes: 'autorotate' }
        });
      }

      if (!bodyIdToName[start]) {
        bodyIdToName[start] = startName;
      }
      if (!bodyIdToName[end]) {
        bodyIdToName[end] = endName;
      }
    });

    const nodes = query.pm.bodyIds.map(bodyId => {
      const label =
        bodyIdToName[bodyId] && bodyIdToName[bodyId] !== null
          ? `${bodyIdToName[bodyId]}\n(${bodyId})`
          : bodyId;
      return { data: { id: bodyId, label } };
    });

    return {
      columns: ['start', 'end', 'weight', 'startName', 'endName'],
      data: apiResponse.data,
      graph: { elements: { nodes, edges }, minWeight: minObsWeight, maxWeight: maxObsWeight },
      debug: apiResponse.debug,
      title: `Connectivity graph for ${bodyIds}`
    };
  }

  static fetchParameters(params) {
    const { bodyIds, dataset } = params;
    const cypherQuery = `WITH [${bodyIds}] AS input MATCH (n:\`${dataset}-Neuron\`)-[c:ConnectsTo]->(m) WHERE n.bodyId IN input AND m.bodyId IN input RETURN n.bodyId AS start, m.bodyId AS end, c.weight AS weight, n.name AS startName, m.name AS endName`;
    return {
      cypherQuery
    };
  }

  constructor(props) {
    super(props);
    this.state = {
      includeAutapses: true,
      minWeight: 1,
      bodyIds: ''
    };
  }

  // creates query object and sends to callback
  processRequest = () => {
    const { dataSet, submit } = this.props;
    const { bodyIds, includeAutapses, minWeight } = this.state;

    const query = {
      dataSet,
      plugin: pluginName,
      pluginCode: pluginAbbrev,
      parameters: {
        dataset: dataSet,
        bodyIds: bodyIds === '' ? [] : bodyIds.split(',').map(Number),
        minWeight,
        includeAutapses
      }
    };
    submit(query);
  };

  addNeuronBodyIds = event => {
    this.setState({ bodyIds: event.target.value });
  };

  handleMinWeightChange = event => {
    this.setState({ minWeight: event.target.value });
  };

  toggleAutapses = () => {
    const { includeAutapses } = this.state;
    this.setState({ includeAutapses: !includeAutapses });
  };

  catchReturn = event => {
    // submit request if user presses enter
    if (event.keyCode === 13) {
      event.preventDefault();
      this.processRequest();
    }
  };

  render() {
    const { isQuerying, classes } = this.props;
    const {
      inputIncludeFilters,
      inputExcludeFilters,
      outputIncludeFilters,
      outputExcludeFilters,
      connectionIncludeFilters,
      connectionExcludeFilters,
      includeAutapses,
      minWeight,
      bodyIds
    } = this.state;

    return (
      <div>
        <FormControl fullWidth className={classes.formControl}>
          <TextField
            label="Neuron IDs"
            multiline
            fullWidth
            margin="dense"
            rows={1}
            value={bodyIds}
            name="bodyIds"
            rowsMax={4}
            helperText="Separate IDs with commas."
            onChange={this.addNeuronBodyIds}
            onKeyDown={this.catchReturn}
          />
        </FormControl>
        {/* <FormControl component="fieldset" className={classes.formControl}>
          <FormLabel component="legend">Input Filters</FormLabel>
          <TextField
            label="Include"
            multiline
            fullWidth
            margin="dense"
            rows={1}
            value={inputIncludeFilters}
            name="bodyIds"
            rowsMax={4}
            helperText="Separate IDs with commas."
            variant="outlined"
          />
          <TextField
            label="Exclude"
            multiline
            fullWidth
            margin="dense"
            rows={1}
            value={inputExcludeFilters}
            name="bodyIds"
            rowsMax={4}
            variant="outlined"
          />
        </FormControl>
        <FormControl component="fieldset" className={classes.formControl}>
          <FormLabel component="legend">Output Filters</FormLabel>
          <TextField
            label="Include"
            multiline
            fullWidth
            margin="dense"
            rows={1}
            value={outputIncludeFilters}
            name="bodyIds"
            rowsMax={4}
            variant="outlined"
          />
          <TextField
            label="Exclude"
            multiline
            fullWidth
            margin="dense"
            rows={1}
            value={outputExcludeFilters}
            name="bodyIds"
            rowsMax={4}
            variant="outlined"
          />
        </FormControl>
        <FormControl component="fieldset" className={classes.formControl}>
          <FormLabel component="legend">Connection Filters</FormLabel>
          <TextField
            label="Include"
            multiline
            fullWidth
            margin="dense"
            rows={1}
            value={connectionIncludeFilters}
            name="bodyIds"
            rowsMax={4}
            variant="outlined"
          />
          <TextField
            label="Exclude"
            multiline
            fullWidth
            margin="dense"
            rows={1}
            value={connectionExcludeFilters}
            name="bodyIds"
            rowsMax={4}
            variant="outlined"
          />
          <p>Pre + Post Synaptic Filters</p>
        </FormControl> */}
        <FormControl className={classes.formControl}>
          <TextField
            label="minimum weight"
            type="number"
            margin="dense"
            rows={1}
            value={minWeight}
            rowsMax={1}
            onChange={this.handleMinWeightChange}
          />
        </FormControl>
        <FormControl className={classes.formControl}>
          <FormControlLabel
            control={
              <Switch checked={includeAutapses} onChange={this.toggleAutapses} color="primary" />
            }
            label="Include autapses"
          />
        </FormControl>
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

ConnectivityGraph.propTypes = {
  dataSet: PropTypes.string.isRequired,
  isQuerying: PropTypes.bool.isRequired,
  submit: PropTypes.func.isRequired,
  classes: PropTypes.object.isRequired
};

export default withStyles(styles, { withTheme: true })(ConnectivityGraph);
