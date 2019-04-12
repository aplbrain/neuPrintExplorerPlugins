import React from 'react';
import PropTypes from 'prop-types';
import randomColor from 'randomcolor';
import Immutable from 'immutable';
import PouchDB from 'pouchdb';
import deepEqual from 'deep-equal';

import { withStyles } from '@material-ui/core/styles';
import Chip from '@material-ui/core/Chip';

import SharkViewer from '@janelia/sharkviewer';
import CompartmentSelection from './Skeleton/CompartmentSelection';

const styles = theme => ({
  root: {
    position: 'relative',
    width: '100%',
    height: '100%',
    marginTop: theme.spacing.unit * 1,
    backgroundColor: 'white'
  },
  floater: {
    zIndex: 2,
    padding: theme.spacing.unit,
    position: 'absolute'
  },
  footer: {
    zIndex: 2,
    padding: theme.spacing.unit,
    position: 'absolute',
    top: 0,
    right: 0
  },
  skel: {
    width: '100%',
    height: '100%',
    background: '#ddd',
    zIndex: 1,
    position: 'relative'
  },
  chip: {
    margin: theme.spacing.unit / 2
  },
  minimize: {
    zIndex: 2,
    position: 'absolute',
    top: '1em',
    right: '1em'
  }
});

const skeletonQuery =
  'MATCH (:`YY-Neuron` {bodyId:ZZ})-[:Contains]->(:Skeleton)-[:Contains]->(root :SkelNode) WHERE NOT (root)<-[:LinksTo]-() RETURN root.rowNumber AS rowId, root.location.x AS x, root.location.y AS y, root.location.z AS z, root.radius AS radius, -1 AS link ORDER BY root.rowNumber UNION match (:`YY-Neuron` {bodyId:ZZ})-[:Contains]->(:Skeleton)-[:Contains]->(s :SkelNode)<-[:LinksTo]-(ss :SkelNode) RETURN s.rowNumber AS rowId, s.location.x AS x, s.location.y AS y, s.location.z AS z, s.radius AS radius, ss.rowNumber AS link ORDER BY s.rowNumber';

class SkeletonView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sharkViewer: {
        animate: () => {}
      },
      db: new PouchDB('neuprint_compartments'),
      bodies: Immutable.Map({}),
      compartments: Immutable.Map({})
    };
    this.skelRef = React.createRef();
  }

  componentDidMount() {
    const { query } = this.props;
    // check for neurons and compartments here and load them into the state
    if (query.pm.dataSet) {
      if (query.pm.bodyIds) {
        const bodyIds = query.pm.bodyIds.toString().split(',');
        this.addSkeletons(bodyIds, query.pm.dataSet);
      }
      if (query.pm.compartments) {
        const compIds = query.pm.compartments.split(',');
        this.addCompartments(compIds, query.pm.dataSet);
      }
    }
    this.createShark();
  }

  componentDidUpdate(prevProps, prevState) {
    const { query } = this.props;
    if (!deepEqual(this.props, prevProps)) {
      // only perform actions here that alter the state, no rendering or props changes
      const { bodyIds = '', compartments: compartmentIds = '', dataSet } = query.pm;
      const {
        bodyIds: prevBodyIds = '',
        compartments: prevCompartmentIds = ''
      } = prevProps.query.pm;

      const bodyIdList = bodyIds
        .toString()
        .split(',')
        .filter(x => x);
      const prevBodyIdList = prevBodyIds
        .toString()
        .split(',')
        .filter(x => x);
      const compartmentIdList = compartmentIds
        .toString()
        .split(',')
        .filter(x => x);
      const prevCompartmentIdList = prevCompartmentIds
        .toString()
        .split(',')
        .filter(x => x);

      // remove bodies that are no longer in props
      const currentBodySet = new Set(bodyIdList);
      const missingBodies = prevBodyIdList.filter(bodyId => !currentBodySet.has(bodyId));
      missingBodies.forEach(missingId => {
        this.removeSkeleton(missingId);
      });
      // remove compartments that are no longer in props
      const currentCompartmentSet = new Set(compartmentIdList);
      const missingCompartments = prevCompartmentIdList.filter(
        compartmentId => !currentCompartmentSet.has(compartmentId)
      );
      this.removeCompartmentsFromState(missingCompartments);

      // load bodies that are new
      const prevBodySet = new Set(prevBodyIdList);
      const newBodyIds = bodyIdList.filter(bodyId => !prevBodySet.has(bodyId));
      this.addSkeletons(newBodyIds, query.pm.dataSet);

      // load compartments that are new
      const prevCompartmentSet = new Set(prevCompartmentIdList);
      const newCompartmentIds = compartmentIdList.filter(
        compartmentId => !prevCompartmentSet.has(compartmentId)
      );
      this.addCompartments(newCompartmentIds, dataSet);
    }
    if (!deepEqual(this.state, prevState)) {
      // only perform actions here that update the canvas rendering.
      const { bodies, compartments } = this.state;
      const { bodies: prevBodies, compartments: prevCompartments } = prevState;

      // un-render missing bodies
      const currentBodies = new Set(Object.keys(bodies.toJS()));
      const missingBodies = Object.keys(prevBodies.toJS()).filter(
        bodyId => !currentBodies.has(bodyId)
      );
      missingBodies.forEach(bodyId => {
        this.unloadBody(bodyId);
      });
      // un-render hidden bodies
      bodies
        .filter(body => !body.get('visible'))
        .forEach(body => {
          this.unloadBody(body.get('name'));
        });

      // un-render missing compartments
      const currentCompartments = new Set(Object.keys(compartments.toJS()));
      const missingCompartments = Object.keys(prevCompartments.toJS()).filter(
        compId => !currentCompartments.has(compId)
      );
      missingCompartments.forEach(compId => {
        this.unloadCompartment(compId);
      });

      // render new bodies
      const prevBodiesSet = new Set(Object.keys(prevBodies.toJS()));
      const newBodyIds = Object.keys(bodies.toJS()).filter(bodyId => !prevBodiesSet.has(bodyId));

      const moveCamera = query.pm.coordinates ? false : true;

      this.renderBodies(newBodyIds, moveCamera);

      // render bodies made visible again
      bodies
        .filter(body => body.get('visible'))
        .forEach(body => {
          this.renderBodies([body.get('name')]);
        });

      // render new compartments
      const prevCompartmentSet = new Set(Object.keys(prevCompartments.toJS()));
      const newCompartments = compartments.filter(
        compartment => !prevCompartmentSet.has(compartment.get('name'))
      );
      this.renderCompartments(newCompartments);
    }
  }

  componentWillUnmount() {
    const { sharkViewer } = this.state;
    const { actions, query, index } = this.props;

    const bodyIds = query.pm.bodyIds.toString().split(',');

    // Set the correct query string to store the camera position.
    // TODO: we need to do this every time the camera position is changed,
    // otherwise camera position will be lost on page refresh.
    if (bodyIds.length > 0) {
      const coords = sharkViewer.cameraCoords();
      const target = sharkViewer.cameraTarget();

      const coordinateString = `${coords.x},${coords.y},${coords.z},${target.x},${target.y},${
        target.z
      }`;
      const tabData = actions.getQueryObject('qr', []);
      // if we have switched tabs and not removed the skeleton tab then we
      // need to keep track of the camera position.
      if (tabData[index]) {
        tabData[index].pm.coordinates = coordinateString;
        actions.setQueryString({
          qr: tabData
        });
      }
    }
  }

  createShark = () => {
    const { query } = this.props;
    const sharkViewer = new SharkViewer({
      dom_element: 'skeletonviewer',
      WIDTH: this.skelRef.current.clientWidth,
      HEIGHT: this.skelRef.current.clientHeight
    });
    sharkViewer.init();
    sharkViewer.animate();

    if (query.pm.coordinates) {
      const coords = query.pm.coordinates.split(',');
      const target = {
        x: parseFloat(coords[3]),
        y: parseFloat(coords[4]),
        z: parseFloat(coords[5])
      };
      sharkViewer.restoreView(
        parseFloat(coords[0]),
        parseFloat(coords[1]),
        parseFloat(coords[2]),
        target
      );
    }

    sharkViewer.render();
    sharkViewer.render();
    this.setState({ sharkViewer });
    // UGLY: there is a weird bug that means sometimes the scene is rendered blank.
    // it seems to be some sort of timing issue, and adding a delayed render seems
    // to fix it.
    setTimeout(() => {
      sharkViewer.render();
    }, 200);
  };

  handleDelete = id => () => {
    const { actions, query, index } = this.props;
    const { bodies } = this.state;
    const updated = bodies.delete(id);
    this.setState({ bodies: updated });
    actions.skeletonRemove(id, query.pm.dataSet, index);
    // action passed in from Results that removes id from the url
  };

  handleClick = id => () => {
    const { bodies } = this.state;
    const visible = !bodies.getIn([id, 'visible']);
    const updated = bodies.setIn([id, 'visible'], visible);
    this.setState({ bodies: updated });
  };

  addCompartment = (id, dataset) => {
    if (id === '') {
      return;
    }
    const { neo4jsettings } = this.props;
    const meshHost = neo4jsettings.get('meshInfo')[dataset];
    const { uuid } = neo4jsettings.get('datasetInfo')[dataset];

    if (meshHost && uuid) {
      fetch(`${meshHost}/api/node/${uuid}/rois/key/${id}`, {
        headers: {
          'Content-Type': 'text/plain',
          Accept: 'application/json'
        },
        method: 'GET'
      })
        .then(result => result.json())
        .then(result => {
          const { key } = result['->'];
          this.fetchMesh(id, key, meshHost, uuid);
        })
        .catch(error => this.setState({ loadingError: error }));
    }
  };

  updateCompartments = updated => {
    const { actions, index } = this.props;
    const tabData = actions.getQueryObject('qr', []);
    tabData[index].pm.compartments = updated.join(',');
    actions.setQueryString({
      qr: tabData
    });
  };

  unloadCompartment(id) {
    const { sharkViewer } = this.state;
    sharkViewer.unloadCompartment(id);
    sharkViewer.render();
    sharkViewer.render();
    // UGLY: there is a weird bug that means sometimes the scene is rendered blank.
    // it seems to be some sort of timing issue, and adding a delayed render seems
    // to fix it.
    setTimeout(() => {
      sharkViewer.render();
    }, 200);
  }

  unloadBody(id) {
    const { sharkViewer } = this.state;
    sharkViewer.unloadNeuron(id);
    sharkViewer.render();
    sharkViewer.render();
    // UGLY: there is a weird bug that means sometimes the scene is rendered blank.
    // it seems to be some sort of timing issue, and adding a delayed render seems
    // to fix it.
    setTimeout(() => {
      sharkViewer.render();
    }, 200);
  }

  removeCompartmentsFromState(ids) {
    const { compartments } = this.state;
    const updated = compartments.deleteAll(ids);
    this.setState({ compartments: updated });
    return updated;
  }

  fetchMesh(id, key, host, uuid) {
    return fetch(`${host}/api/node/${uuid}/roi_data/key/${key}`, {
      headers: {
        'Content-Type': 'text/plain',
        Accept: 'text/plain'
      },
      method: 'GET'
    })
      .then(result => result.text())
      .then(result => {
        this.skeletonLoadedCompartment(id, result);
      });
  }

  addCompartments(cIds, dataSet) {
    cIds.forEach(id => {
      this.addCompartment(id, dataSet);
    });
  }

  skeletonLoadedCompartment(id, result) {
    const { db, compartments } = this.state;
    const compartment = Immutable.Map({
      name: id,
      obj: 'localStorage',
      visible: true,
      color: '#000000'
    });
    return db
      .putAttachment(id, 'obj', btoa(result), 'text/plain')
      .then(() => {
        const updated = compartments.set(id, compartment);
        this.setState({ compartments: updated });
      })
      .catch(err => {
        if (err.name === 'conflict') {
          const updated = compartments.set(id, compartment);
          this.setState({ compartments: updated });
        } else {
          this.setState({
            loadingError: err
          });
        }
      });
  }

  addSkeleton(bodyId, dataSet) {
    if (bodyId === '') {
      return;
    }
    // generate the querystring.
    const completeQuery = skeletonQuery.replace(/YY/g, dataSet).replace(/ZZ/g, bodyId);
    // fetch swc data
    // TODO: check if we have a cached copy of the data and skip the fetch if we do.
    // document key should be sk_<id>
    //
    // we can fetch the timestamps with the following neuprint cypher query:
    // WITH [1,2] AS ids MATCH (n:`mb6-Neuron`)-[:Contains]->(s:Skeleton) WHERE n.bodyId IN ids RETURN n.bodyId,s.timeStamp
    // That will return the timestamps for each of the neurons, then if it is different or blank,
    // we fetch the swc data.
    fetch('/api/custom/custom', {
      headers: {
        'content-type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        cypher: completeQuery
      }),
      method: 'POST',
      credentials: 'include'
    })
      .then(result => result.json())
      .then(result => {
        if ('error' in result) {
          throw result.error;
        }
        this.skeletonLoaded(bodyId, dataSet, result);
      })
      .catch(error => this.setState({ loadingError: error }));
  }

  addSkeletons(bodyIds, dataSet) {
    bodyIds.forEach(id => {
      this.addSkeleton(id, dataSet);
    });
  }

  skeletonLoaded(id, dataSet, result) {
    const { db } = this.state;
    // parse the result into swc format for skeleton viewer code.
    const data = {};

    result.data.forEach(row => {
      data[parseInt(row[0], 10)] = {
        x: parseInt(row[1], 10),
        y: parseInt(row[2], 10),
        z: parseInt(row[3], 10),
        radius: parseInt(row[4], 10),
        parent: parseInt(row[5], 10)
      };
    });

    // check to see if we have a color cached for this neuron.
    // if yes, then return the color,
    // else, generate random color and cache it.
    db.get(`sk_${id}`)
      .then(doc => {
        const { color } = doc;
        this.addSkeletonToState(id, dataSet, data, color);
      })
      .catch(() => {
        const color = randomColor({ luminosity: 'light', hue: 'random' });
        db.put({
          _id: `sk_${id}`,
          color
        }).then(() => {
          this.addSkeletonToState(id, dataSet, data, color);
        });
      });
  }

  addSkeletonToState(id, dataSet, data, color) {
    const { bodies } = this.state;
    const updated = bodies.set(
      id,
      Immutable.Map({
        name: id,
        dataSet,
        swc: data,
        color,
        visible: true
      })
    );
    this.setState({ bodies: updated });
  }

  removeSkeleton(id) {
    const { bodies } = this.state;
    const updated = bodies.delete(id);
    this.setState({ bodies: updated });
  }

  renderBodies(ids, moveCamera=false) {
    const { sharkViewer, bodies } = this.state;
    ids.forEach(id => {
      const body = bodies.get(id);
      // If added, then add them to the scene.
      const exists = sharkViewer.scene.getObjectByName(body.get('name'));
      if (!exists) {
        sharkViewer.loadNeuron(body.get('name'), body.get('color'), body.get('swc'), moveCamera);
      }
      // if hidden, then hide them.
      sharkViewer.setNeuronVisible(body.get('name'), body.get('visible'));
    });
    sharkViewer.render();
    sharkViewer.render();
    // UGLY: there is a weird bug that means sometimes the scene is rendered blank.
    // it seems to be some sort of timing issue, and adding a delayed render seems
    // to fix it.
    setTimeout(() => {
      sharkViewer.render();
    }, 200);
  }

  renderCompartments(rois) {
    const { sharkViewer, db } = this.state;
    const moveCamera = false;
    rois.forEach(roi => {
      const exists = sharkViewer.scene.getObjectByName(roi.get('name'));
      if (!exists) {
        const reader = new FileReader();

        reader.addEventListener('loadend', () => {
          sharkViewer.loadCompartment(roi.get('name'), roi.get('color'), reader.result, moveCamera);
        });

        db.getAttachment(roi.get('name'), 'obj').then(obj => {
          reader.readAsText(obj);
        });
      }
    });
  }

  render() {
    const { classes, query, neo4jsettings } = this.props;

    const { compartments = '' } = query.pm;

    const compartmentIds = compartments.split(',').filter(x => x);

    const { bodies } = this.state;

    const chips = bodies.map(neuron => {
      // gray out the chip if it is not active.
      let currcolor = neuron.get('color');
      if (!neuron.get('visible')) {
        currcolor = 'gray';
      }

      const name = neuron.get('name');

      return (
        <Chip
          key={name}
          label={name}
          onDelete={this.handleDelete(name)}
          onClick={this.handleClick(name)}
          className={classes.chip}
          style={{ background: currcolor }}
        />
      );
    });

    const chipsArray = chips.valueSeq().toArray();

    // pass action callbacks to add or remove compartments to
    // the compartment selection component.
    const compartmentActions = {
      setROIs: this.updateCompartments
    };

    const compartmentSelection = (
      <CompartmentSelection
        availableROIs={neo4jsettings.get('availableROIs')}
        selectedROIs={compartmentIds}
        dataSet={query.pm.dataSet}
        actions={compartmentActions}
      />
    );

    return (
      <div className={classes.root}>
        <div className={classes.floater}>{chipsArray}</div>
        <div className={classes.footer}>{compartmentSelection}</div>
        <div className={classes.skel} ref={this.skelRef} id="skeletonviewer" />
      </div>
    );
  }
}

SkeletonView.propTypes = {
  query: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  classes: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  neo4jsettings: PropTypes.object.isRequired
};

export default withStyles(styles)(SkeletonView);
