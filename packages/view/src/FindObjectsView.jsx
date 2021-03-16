import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import Table from '@material-ui/core/Table';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TableBody from '@material-ui/core/TableBody';
import Typography from '@material-ui/core/Typography';
import {
    getQueryString,
    setSearchQueryString
} from 'helpers/queryString';

import NodeTable from './ObjectsView/NodeTable';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
  },
  clickable: {
    textDecoration: 'underline',
    color: theme.palette.primary.main,
    cursor: 'pointer',
  },
  scroll: {
    marginTop: theme.spacing(1),
    overflowY: 'auto',
    overflowX: 'auto',
  },
}));

function a11yProps(index) {
  return {
    id: `objectview-tab-${index}`,
    'aria-controls': `objectview-tabpanel-${index}`,
  };
}

export default function FindObjectsView({ query }) {
  const history = useHistory();
  const classes = useStyles();
  const [tabIndex, setTabIndex] = useState(0);
  const [parent, setParent] = useState();
  const { result } = query;

  useEffect(() => {
    // load parent information from cypher here
    if (result.data.matchedObject) {
      const [x, y, z] = result.data.matchedObject.location.coordinates;
      const cypher = `MATCH (n:Element)-[x:Contains]-(m)-[y:Contains]-(o:Cell) WHERE n.location = Point({x:${x} ,y:${y} ,z:${z} }) return o, labels(o), labels(m)`;

      const options = {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          dataset: query.ds,
          cypher,
        }),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      };

      fetch('/api/custom/custom?np_explorer=view_FindObjectsView', options).then(response => response.json())
        .then(res => setParent(res))
        .catch(err => console.log(err));
    }
  }, [result.data.matchedObject]);

  const handleChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  const tabs = [];
  const tabContents = [];

  const objectTypes = ['mitochondrion', 'pre', 'post'];

  const { connections } = result.data;

  const handleParentClick = (bodyId) => {
    setSearchQueryString({
      code: 'cos',
      ds: query.ds,
      pm: {
        cypherQuery: `MATCH(n :Cell {bodyId: ${bodyId}}) -[x:Contains]-> () -[y:Contains]-> (m:Element) RETURN DISTINCT ID(m), m.type, m`,
        dataset: query.ds,
        bodyId,
      }
    });
    history.push({
      pathname: '/results',
      search: getQueryString()
    });
  }

  objectTypes.filter(type => connections[type]).forEach(type => {
    const label = type === 'mitochondrion' ? 'mitochondria' : type;
    /* eslint-disable-next-line react/jsx-props-no-spreading  */
    tabs.push(<Tab key={type} label={type} {...a11yProps(0)} />);
    tabContents.push(<NodeTable key={type} rows={connections[type]} columns={result.columns[type]} />);
  });

  if (!result.data.matchedObject) {
    return (
      <div className={classes.root}>
        <div className={classes.scroll}>
          <Typography variant="h5">No Object Connections found</Typography>
        </div>
      </div>
    )
  }

  const matchedCoordinates = result.data.matchedObject.location.coordinates.join(', ');

  return (
    <div className={classes.root}>
      <div className={classes.scroll}>
        <Typography variant="h5">Object</Typography>
        <Table style={{marginBottom: '1em'}}>
          <TableHead>
            <TableRow>
              <TableCell>Location</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Found within Object</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>{matchedCoordinates}</TableCell>
              <TableCell>{result.data.matchedObject.type}</TableCell>
              <TableCell>
              { parent && parent.data && parent.data[0] ? (
                <Typography>
                  <Button className={classes.clickable} onClick={() => handleParentClick(parent.data[0][0].bodyId)}>{parent.data[0][0].bodyId}</Button>
                </Typography>
              ) : '-'}

              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Typography variant="h5">Connections</Typography>
        <Tabs value={tabIndex} onChange={handleChange} indicatorColor="primary">
          {tabs}
        </Tabs>
        {tabContents[tabIndex]}
      </div>
    </div>
  );
}

FindObjectsView.propTypes = {
  query: PropTypes.object.isRequired,
};
