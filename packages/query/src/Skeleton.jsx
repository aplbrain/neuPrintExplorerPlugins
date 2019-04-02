/*
 * Query form to load skeleton view with provided ids.
*/
import React from 'react';
import PropTypes from 'prop-types';

import Button from '@material-ui/core/Button';
import FormControl from '@material-ui/core/FormControl';
import TextField from '@material-ui/core/TextField';
import { withStyles } from '@material-ui/core/styles';

const pluginName = 'Skeleton';
const pluginAbbrev = 'sk';

const styles = theme => ({
  formControl: {
    margin: theme.spacing.unit
  }
});


class Skeleton extends React.Component {
  static get details() {
    return {
      name: pluginName,
      displayName: pluginName,
      abbr: pluginAbbrev,
      experimental: true,
      download: false,
      category: 'other',
      description: 'Submit a list of neuron Ids to see their skeleton in 3D',
      visType: 'SkeletonView'
    };
  }

  static fetchParameters() {
    return {
      skip: true
    };
  }

  static processResults(query) {
    return {
      debug: 'No cypher query for this plugin',
      title: `Skeleton viewer for ${query.pm.dataSet}`,
    };
  };

  constructor(props) {
    super(props);
    this.state = {
      bodyIds: ''
    };
  }

  // creates query object and sends to callback
  processRequest = () => {
    const { dataSet, submit } = this.props;
    const { bodyIds } = this.state;
    const query = {
      dataSet,
      plugin: pluginName,
      pluginCode: pluginAbbrev,
      parameters: {
        dataSet,
        skip: true, // skip the data fetching in Requests.
        bodyIds
      },
    };
    submit(query);
  };

  addNeuronBodyIds = event => {
    this.setState({
      bodyIds: event.target.value
    });
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
    const { bodyIds } = this.state;
    return (
      <div>
        <FormControl fullWidth className={classes.formControl}>
          <TextField
            label="Neuron IDs"
            multiline
            fullWidth
            rows={1}
            value={bodyIds}
            name="bodyIds"
            rowsMax={4}
            helperText="Separate IDs with commas."
            onChange={this.addNeuronBodyIds}
            onKeyDown={this.catchReturn}
          />
        </FormControl>
        <Button disabled={isQuerying} variant="contained" color="primary" onClick={this.processRequest}>
          Submit
        </Button>
      </div>
    );
  }
}

Skeleton.propTypes = {
  dataSet: PropTypes.string.isRequired,
  isQuerying: PropTypes.bool.isRequired,
  submit: PropTypes.func.isRequired,
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles, { withTheme: true })(Skeleton);
