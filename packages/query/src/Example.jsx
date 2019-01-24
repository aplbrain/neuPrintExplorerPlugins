import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';

// This module is used to choose the color for the
import randomColor from 'randomcolor';


// neuPrintExplorer uses the Material-UI (https://material-ui.com/) for all
// styles and layout. You will need to study its documentation to figure out
// which components to import for the form you are trying to create. For this
// example we will have a single submit button and a text field with a label.
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import FormControl from '@material-ui/core/FormControl';
import { withStyles } from '@material-ui/core/styles';

// this should match the name of the file this plugin is stored in.
const pluginName = 'Example';

// The styles object is used by the component to pass style information
// to the Material-UI components. This can be ignored if you don't plan
// on setting any custom styles, but will most likely be needed to generate
// an intuitive form. More information on how styling works can be found at:
// https://material-ui.com/css-in-js/basics/
// https://material-ui.com/css-in-js/basics/#higher-order-component-api
const styles = () => ({
  textField: {
    width: 300,
    margin: '0 0 1em 0'
  },
  button: {
    margin: 4,
    display: 'block'
  },
  formControl: {}
});

// A plugin abbreviation is required to denote the parameters used by the plugin, in the
// url. This is how we decide which query parameters belong to a specific plugin. The
// abbreviation can be longer than 2 characters and should be unique.
const pluginAbbrev = 'ex';

// The core of the plugin is the class. This will encapsulate the core functions
// that are required for the plugin to work. The class name should match the plugin
// name.
class Example extends React.Component {

  // Return a text string that will be displayed in the query type
  // selection box in neuPrintExplorer.
  static get queryName() {
    return 'Example';
  }

  // Return a longer description of the plugin, including its' purpose and expected
  // results.
  static get queryDescription() {
    return 'Example query plugin';
  }

  static get queryAbbreviation() {
    return pluginAbbrev;
  }


  // processRequest is generally triggered by hitting the submit button and
  // is your opportunity to gather the parameters for your query, format them
  // and send them off to the api. It does not take any direct arguments, but will
  // need to fetch values from the class properties.
  processRequest = () => {

    // gather important information from the application:
    // > dataSet - text string to describe selected data set.
    // > actions - an object that contains functions for interacting with the
    //             application. A list of these can be found in the README.
    // > history - the history object is used to route the application to the
    //             correct results page.
    const { dataSet, actions, history } = this.props;
    // fetch all the parameters used by this plugin from the URL query string.
    // you can also set default values here.
    const { textValue = '' } = actions.getQueryObject(pluginAbbrev);
    // The query object is expected to include a few important components,
    // please see the comments below for a description of each.:
    const query = {
      // dataSet - text string received from the application properties.
      dataSet,
      // cypherQuery - in this case it is a text string passed in from the URL
      // query string, that was set by your form.
      cypherQuery: textValue,
      // visType - The name of the visualization plugin that will be used to
      // display the results. A list of these can be found in the view plugins
      // module
      visType: 'SimpleTable',
      // plugin - text string so that we know the name of the plugin based
      plugin: pluginName,
      // parameters - an object of additional parameters to be passed to the
      // neuPrintHTTP API.
      parameters: {},
      // title - Text string to be placed at the top of the results tab for
      // this result.
      title: 'Custom query',
      // menuColor - Hex code string that will be used to color the results tile
      // this can be set randomly or as a static color. Up to you.
      menuColor: randomColor({ luminosity: 'light', hue: 'random' }),
      // processResults - function - this is used to process the results returned
      // by the API server so that they can be displayed by the view.
      processResults: this.processResults
    };
    // submit your query for processing by the API.
    actions.submit(query);
    // redirect to the results page, so that the query can be viewed.
    history.push({
      pathname: '/results',
      search: actions.getQueryString()
    });
    return query;
  };

  // This function always receives two parameters:
  // query - this is the object that was created in the processRequest
  // function and passed to the main application.
  //
  // apiResponse - the response from the api server. This will contain the
  // data payload and any error messages that may have occurred.
  processResults = (query, apiResponse) => {
    // check the response to see if you have any data.
    if (apiResponse.data) {
      // format the data here. In this case we are converting any objects returned
      // into their string representations.
      const data = apiResponse.data.map(row =>
        row.map(item => (typeof item === 'object' ? JSON.stringify(item) : item))
      );
      // make sure that the data structure you return meets the requirements of the
      // visualisation plugin you have chosen.
      return {
        columns: apiResponse.columns,
        data,
        debug: apiResponse.debug
      };
    }

    // If the plugin has returned nothing, then you need to make sure that the
    // visualization plugin you selected gets the data in the format that it
    // requires. For the simple table plugin, it needs to have three elements in
    // the object it receives.
    // - columns
    // - data
    // - debug
    return {
      columns: [],
      data: [],
      debug: ''
    };
  };


  // Whenever someone changes a value in the form, we need to make sure it is
  // captured in the url. This serves two purposes.
  // 1. this is the only place where the selections are stored.
  // 2. can always return to the form from a link.
  handleChange = event => {
    const { actions } = this.props;
    actions.setQueryString({
      [pluginAbbrev]: {
        textValue: event.target.value
      }
    });
  };

  // render() is the main function that handles displaying the form. This requires
  // a few properties passed in from neuPrintExplorer, but will take no direct
  // arguments.
  render() {
    // Below are the only three properties that you must have to get a working
    // plugin.
    //
    // 1. actions is an object that contains methods to report back to
    // the core application. The list of actions are:
    //
    //   - submit
    //   -
    //   -
    //
    // 2. classes are the styles that were set in the styles constant at the top
    // of this file. See the documentation there for uses.
    //
    // 3. isQuerying is a simple boolean that will tell you if the site is currently
    // executing a query. This is useful for disabling form submission once a query
    // has been submitted.
    const { actions, classes, isQuerying } = this.props;

    // Here we can set the default values for the plugin and fetch
    // any existing ones that have already been selected.
    const { textValue = '' } = actions.getQueryObject(pluginAbbrev);

    // Finally we need to return the filled out form. This is pieced together
    // using the material-UI form components and JSX. Examples can be found
    // here: https://material-ui.com/demos/text-fields/
    //
    // In this example we have a text filed that accepts a text string and
    // calls the handleChange method to store it, followed by a submit button
    // that calls the processRequest method when clicked.
    //
    return (
      <FormControl className={classes.formControl}>
        <TextField
          label="Custom Cypher Query"
          multiline
          value={textValue}
          rows={1}
          rowsMax={4}
          className={classes.textField}
          onChange={this.handleChange}
        />
        <Button
          variant="contained"
          className={classes.button}
          onClick={this.processRequest}
          color="primary"
          disabled={isQuerying}
        >
          Submit
        </Button>
      </FormControl>
    );
  }
}

// property Types or propTypes describe the items that will be passed
// to the plugin and you will be required to add them. It is probably
// sufficient to copy this data structure into your plugin and change
// 'Example' to your plugin name.
Example.propTypes = {
  classes: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  dataSet: PropTypes.string.isRequired,
  history: PropTypes.object.isRequired,
  isQuerying: PropTypes.bool.isRequired
};

// Finally we need to export the plugin into the main application so that
// it is registered with the site. This will add it to the Query selection
// menu and allow users to select it.
export default withStyles(styles)(withRouter(Example));
