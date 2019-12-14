/*
 * Query to view a cell type summary card.
 */
import React from 'react';
import PropTypes from 'prop-types';

import Button from '@material-ui/core/Button';
import FormControl from '@material-ui/core/FormControl';
import TextField from '@material-ui/core/TextField';
import { withStyles } from '@material-ui/core/styles';

const pluginName = 'Cell Types';
const pluginAbbrev = 'ct';

const columnHeaders = ['id', 'instance', 'type', '#connections'];

const styles = theme => ({
  formControl: {
    margin: theme.spacing.unit
  },
  button: {
  }
});

class CellType extends React.Component {
  static get details() {
    return {
      name: pluginName,
      displayName: pluginName,
      abbr: pluginAbbrev,
      category: 'top-level',
      description: 'Cell Type overview',
      visType: 'CellTypeView'
    };
  }

  static getColumnHeaders() {
    return columnHeaders.map(column => ({name: column, status: true}));
  }

  static fetchParameters(params) {
    const { cellType, dataset } = params;
    return {
      queryString: `/npexplorer/celltype/${dataset}/${cellType}`
    };
  }

  static processResults(query, apiResponse) {
    return {
      data: apiResponse,
      debug: "This plugin doesn't use cypher",
      title: `Details for ${query.pm.cellType} in ${query.pm.dataset}`
    };
  }

  static processDownload(response) {
    const headers = columnHeaders.join(',');
    const data = response.result.data
      .map(row => `${row[0]}, ${row[2]}, ${row[3]}, ${row[1]}`)
      .join('\n');
    return [headers, data].join('\n');
  }

  constructor(props) {
    super(props);
    this.state = {
      cellType: '',
    };
  }

  // creates query object and sends to callback
  processRequest = () => {
    const { dataSet, submit } = this.props;
    const { cellType } = this.state;
    const query = {
      dataSet,
      plugin: pluginName,
      pluginCode: pluginAbbrev,
      parameters: {
        dataset: dataSet,
        cellType
      }
    };
    submit(query);
  };

  addCellType = event => {
    this.setState({cellType: event.target.value});
  }

  render() {
    const { isQuerying, classes } = this.props;
    const { cellType } = this.state;
    return (
      <div>
        <FormControl fullWidth className={classes.formControl}>
          <TextField
            label="Cell Type"
            multiline
            fullWidth
            rows={1}
            value={cellType}
            name="cellType"
            rowsMax={4}
            helperText=""
            onChange={this.addCellType}
            onKeyDown={this.catchReturn}
          />
        </FormControl>
        <Button
          variant="contained"
          color="primary"
          disabled={isQuerying}
          onClick={this.processRequest}
        >
          Submit
        </Button>
      </div>
    );
  }
}

CellType.propTypes = {
  dataSet: PropTypes.string.isRequired,
  classes: PropTypes.object.isRequired,
  isQuerying: PropTypes.bool.isRequired,
  submit: PropTypes.func.isRequired
};

export default withStyles(styles)(CellType);