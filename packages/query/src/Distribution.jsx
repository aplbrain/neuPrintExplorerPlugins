/*
 * Plugin for body size distribution.
 */
import React from 'react';
import PropTypes from 'prop-types';
import randomColor from 'randomcolor';
import { withRouter } from 'react-router';

import Button from '@material-ui/core/Button';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import { withStyles } from '@material-ui/core/styles';

const styles = theme => ({
  selects: {
    width: '100%',
    margin: theme.spacing.unit
  }
});

const pluginName = 'Distribution';
const pluginAbbrev = 'dn';

class Distribution extends React.Component {
  static get queryName() {
    return 'Distribution';
  }

  static get queryCategory() {
    return 'recon';
  }

  static get queryDescription() {
    return 'Shows segment size distribution for segments in a given region.';
  }

  static get isExperimental() {
    return true;
  }

  processResults = (query, apiResponse) => {
    const data = [];

    const dist = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0];
    let currdist = 0;

    const distCount = [];
    const distTotal = [];
    let currSize = 0;
    let numSeg = 0;

    apiResponse.data.forEach(record => {
      const size = parseInt(record[1], 10);
      const total = parseInt(record[2], 10);
      currSize += size;
      numSeg += 1;

      while (currdist < dist.length && currSize / total >= dist[currdist]) {
        distCount.push(numSeg);
        distTotal.push(currSize);

        data.push([
          JSON.stringify(dist[currdist]),
          JSON.stringify(distCount[currdist]),
          JSON.stringify(distTotal[currdist])
        ]);
        currdist += 1;
      }
    });

    const typeHeader = query.parameters.is_pre
      ? 'Number of pre-synapses'
      : 'Number of post-synapses';

    return {
      columns: ['percentage', 'num segments', typeHeader],
      data,
      debug: apiResponse.debug
    };
  };

  // creates query object and sends to callback
  processRequest = () => {
    const { dataSet, actions, history } = this.props;
    const { roi = '', isPre = true } = actions.getQueryObject(pluginAbbrev);
    const query = {
      dataSet,
      queryString: '/npexplorer/distribution',
      visType: 'SimpleTable',
      plugin: pluginName,
      parameters: {
        dataset: dataSet,
        ROI: roi,
        is_pre: isPre
      },
      title: `Distribution of body sizes for ${roi}`,
      menuColor: randomColor({ luminosity: 'light', hue: 'random' }),
      processResults: this.processResults
    };
    actions.submit(query);
    history.push({
      pathname: '/results',
      search: actions.getQueryString()
    });
    return query;
  };

  setROI = event => {
    const { actions } = this.props;
    actions.setQueryString({
      [pluginAbbrev]: {
        roi: event.target.value
      }
    });
  };

  setType = event => {
    const { actions } = this.props;
    actions.setQueryString({
      [pluginAbbrev]: {
        isPre: event.target.value
      }
    });
  };

  render() {
    const { isQuerying, classes, availableROIs, actions } = this.props;
    const { roi = '', isPre = true } = actions.getQueryObject(pluginAbbrev);

    const preValue = true;
    const postValue = false;

    return (
      <form>
        <FormControl className={classes.selects}>
          <InputLabel htmlFor="roi">ROI</InputLabel>
          <Select
            value={roi}
            onChange={this.setROI}
            inputProps={{
              name: 'roi',
              id: 'roi'
            }}
          >
            {availableROIs.map(val => (
              <MenuItem key={val} value={val}>
                {val}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <RadioGroup
          aria-label="Type Of Connections"
          name="type"
          value={isPre}
          onChange={this.setType}
        >
          <FormControlLabel value={preValue} control={<Radio color="primary" />} label="Pre-synaptic" />
          <FormControlLabel value={postValue} control={<Radio color="primary" />} label="Post-synaptic" />
        </RadioGroup>

        <Button
          disabled={isQuerying}
          color="primary"
          variant="contained"
          onClick={this.processRequest}
        >
          Submit
        </Button>
      </form>
    );
  }
}

Distribution.propTypes = {
  classes: PropTypes.object.isRequired,
  isQuerying: PropTypes.bool.isRequired,
  availableROIs: PropTypes.arrayOf(PropTypes.string).isRequired,
  dataSet: PropTypes.string.isRequired,
  actions: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired
};

export default withRouter(withStyles(styles)(Distribution));
