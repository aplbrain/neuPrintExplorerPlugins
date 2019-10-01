// Table that handles its own state
import React from 'react';
import PropTypes from 'prop-types';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TablePagination from '@material-ui/core/TablePagination';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import IconButton from '@material-ui/core/IconButton';
import AddIcon from '@material-ui/icons/Add';
import RemoveIcon from '@material-ui/icons/Remove';
import { withStyles } from '@material-ui/core/styles';

// eslint-disable-next-line import/no-unresolved
import TablePaginationActions from '@neuprint/support';

import { stableSort, getSorting, getRoiHeatMapForConnection } from '../shared/vishelpers';

const styles = theme => ({
  root: {
    width: '100%'
  },
  clickable: {
    cursor: 'pointer'
  },
  scroll: {
    marginTop: theme.spacing.unit * 1,
    overflowY: 'auto',
    overflowX: 'auto'
  },
  expansionRow: {
    backgroundColor: '#f7f7f7'
  }
});

class SimpleConnectionsTable extends React.Component {
  constructor(props) {
    super(props);
    const { paginate, page, orderBy, order, rowsPerPage } = this.props;
    this.state = {
      paginate,
      page,
      orderBy,
      order,
      rowsPerPage,
      isExpanded: {},
      expansionPanels: {}
    };
  }

  handleChangePage = (event, page) => {
    this.setState({ page });
  };

  handleChangeRowsPerPage = event => {
    this.setState({ rowsPerPage: event.target.value });
  };

  handleCellClick = action => () => {
    action();
  };

  handleRequestSort = property => () => {
    const { orderBy, order } = this.state;

    const newOrderBy = property;
    const newOrder = orderBy === property && order === 'desc' ? 'asc' : 'desc';

    this.setState({ order: newOrder, orderBy: newOrderBy });
  };

  toggleExpandPanel = (key, parameters) => {
    const { isExpanded, expansionPanels } = this.state;
    const { roiList, connectionWeight, bodyIdA, bodyIdB } = parameters;
    const newIsExpanded = { ...isExpanded };
    const newExpansionPanels = { ...expansionPanels };
    if (isExpanded[key]) {
      delete newIsExpanded[key];
      delete newExpansionPanels[key];
    } else {
      newIsExpanded[key] = true;
      newExpansionPanels[key] = <div>loading...</div>;
      fetch('/api/custom/custom', {
        headers: {
          'content-type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(parameters),
        method: 'POST',
        credentials: 'include'
      })
        .then(result => result.json())
        .then(resp => {
          // sends error message provided by neuprinthttp
          if (resp.error) {
            throw new Error(resp.error);
          }
          const csRoiInfo = JSON.parse(resp.data[0][0]) || {};

          newExpansionPanels[key] = getRoiHeatMapForConnection(
            csRoiInfo,
            roiList,
            connectionWeight,
            bodyIdA,
            bodyIdB
          );

          this.setState({ expansionPanels: newExpansionPanels });
        })
        .catch(error => {
          newExpansionPanels[key] = `Error: ${error}`;
          this.setState({ expansionPanels: newExpansionPanels });
        });
    }
    this.setState({ isExpanded: newIsExpanded, expansionPanels: newExpansionPanels });
  };

  render() {
    const { data = [], columns = [], disableSort, classes, visibleColumns } = this.props;
    let { rowsPerPage } = this.state;
    const { paginate, orderBy, order, page, isExpanded, expansionPanels } = this.state;

    let numCols = 1; // starts at 1 due to expansion button column

    // fit table to data
    if (data.length < rowsPerPage || paginate === false) {
      rowsPerPage = data.length;
    }
    const emptyRows = rowsPerPage - Math.min(rowsPerPage, data.length - page * rowsPerPage);

    const columnCells = columns.map((header, index) => {
      const headerKey = `${header}${index}`;
      numCols += 1;
      if (disableSort.size > 0 && disableSort.has(index)) {
        return <TableCell key={headerKey}>{header}</TableCell>;
      }
      return (
        <TableCell key={headerKey} sortDirection={orderBy === index ? order : false}>
          <TableSortLabel
            active={orderBy === index}
            direction={order}
            onClick={this.handleRequestSort(index)}
          >
            {header}
          </TableSortLabel>
        </TableCell>
      );
    });

    const filteredColumns =
      visibleColumns.size === 0
        ? columnCells
        : columnCells.filter((column, i) => visibleColumns.getIn([i, 'status']));

    return (
      <div className={classes.root}>
        <div className={classes.scroll}>
          <Table padding="dense">
            <TableHead>
              <TableRow>
                <TableCell key="expansionHeader" />
                {filteredColumns}
              </TableRow>
            </TableHead>
            <TableBody>
              {stableSort(data, getSorting(order, orderBy))
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map(row => {
                  const bodyId = row[1].sortBy.toString(); // should be body id
                  const filteredRow =
                    visibleColumns.size === 0
                      ? row
                      : row.filter((column, i) => visibleColumns.getIn([i, 'status']));
                  return (
                    <React.Fragment key={bodyId}>
                      <TableRow hover key={bodyId}>
                        {filteredRow.map((cell, i) => {
                          if (cell && typeof cell === 'object' && 'value' in cell) {
                            const cellKey = `${i}${cell.value}`;
                            if ('action' in cell) {
                              return (
                                <TableCell
                                  className={classes.clickable}
                                  key={cellKey}
                                  onClick={this.handleCellClick(cell.action)}
                                >
                                  {cell.value}
                                </TableCell>
                              );
                            }
                            return <TableCell key={cellKey}>{cell.value}</TableCell>;
                          }
                          if (i === 0) {
                            return (
                              <TableCell key="expansionButton">
                                <IconButton
                                  aria-label="Expand"
                                  onClick={() => this.toggleExpandPanel(bodyId, cell)}
                                >
                                  {isExpanded[bodyId] ? (
                                    <RemoveIcon style={{ width: '.75em', height: '.75em' }} />
                                  ) : (
                                    <AddIcon style={{ width: '.75em', height: '.75em' }} />
                                  )}
                                </IconButton>
                              </TableCell>
                            );
                          }
                          const cellKey = `${i}${cell}`;
                          return <TableCell key={cellKey}>{cell}</TableCell>;
                        })}
                      </TableRow>
                      {isExpanded[bodyId] && (
                        <TableRow key={`${bodyId}panel`} className={classes.expansionRow}>
                          <TableCell
                            colSpan={numCols}
                            style={{ paddingLeft: '10px' }}
                            key={`${bodyId}panelcell`}
                          >
                            {expansionPanels[bodyId]}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              {emptyRows > 0 && (
                <TableRow style={{ height: 48 * emptyRows }}>
                  <TableCell key="empty" colSpan={numCols} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {paginate ? (
          <TablePagination
            component="div"
            count={data.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onChangePage={this.handleChangePage}
            onChangeRowsPerPage={this.handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            ActionsComponent={TablePaginationActions}
          />
        ) : null}
      </div>
    );
  }
}

SimpleConnectionsTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  columns: PropTypes.arrayOf(PropTypes.any).isRequired,
  paginate: PropTypes.bool,
  page: PropTypes.number,
  orderBy: PropTypes.string,
  order: PropTypes.string,
  rowsPerPage: PropTypes.number,
  classes: PropTypes.object.isRequired,
  disableSort: PropTypes.object,
  visibleColumns: PropTypes.object.isRequired
};

SimpleConnectionsTable.defaultProps = {
  paginate: true,
  page: 0,
  orderBy: '',
  order: 'asc',
  rowsPerPage: 5,
  disableSort: new Set([])
};

export default withStyles(styles)(SimpleConnectionsTable);
