// Table that stores state in query.visProps
import React from 'react';
import PropTypes from 'prop-types';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TablePagination from '@material-ui/core/TablePagination';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import { withStyles } from '@material-ui/core/styles';

// eslint-disable-next-line import/no-unresolved
import TablePaginationActions from '@neuprint/support';

import { stableSort, getSorting } from './shared/vishelpers';
import ColumnSelection from './shared/ColumnSelection';

const styles = theme => ({
  root: {
    width: '100%'
  },
  clickable: {
    textDecoration: 'underline',
    color: theme.palette.primary.main,
    cursor: 'pointer'
  },
  scroll: {
    marginTop: theme.spacing.unit * 1,
    overflowY: 'auto',
    overflowX: 'auto'
  }
});

class SimpleTable extends React.Component {
  shouldComponentUpdate(nextProps, nextState) {
    const { query } = this.props;
    if (
      nextProps.query.result === query.result &&
      nextState === this.state &&
      nextProps.query.visProps === query.visProps
    ) {
      return false;
    }
    return true;
  }

  handleChangePage = (event, page) => {
    const { query, actions, index } = this.props;
    const { visProps = {} } = query;
    const newVisProps = Object.assign({}, visProps, { page });

    const updated = Object.assign({}, query, { visProps: newVisProps });
    // TODO: we need to pass in the results data as a separate object from the
    // query. If we don't delete it here the URL explodes when we try to set it
    delete updated.result;

    actions.updateQuery(index, updated);
  };

  handleChangeRowsPerPage = event => {
    const { query, actions, index } = this.props;
    const { visProps = {} } = query;
    const newVisProps = Object.assign({}, visProps, { rowsPerPage: event.target.value });

    const updated = Object.assign({}, query, { visProps: newVisProps });
    // TODO: we need to pass in the results data as a separate object from the
    // query. If we don't delete it here the URL explodes when we try to set it
    delete updated.result;

    actions.updateQuery(index, updated);
  };

  handleCellClick = action => () => {
    action();
  };

  handleRequestSort = property => () => {
    const { query, actions, index } = this.props;
    const { visProps = {} } = query;
    const { orderBy = '', order = 'asc' } = visProps;

    const newOrderBy = property;
    const newOrder = orderBy === property && order === 'desc' ? 'asc' : 'desc';

    const newVisProps = Object.assign({}, visProps, { order: newOrder, orderBy: newOrderBy });

    const updated = Object.assign({}, query, { visProps: newVisProps });
    // TODO: we need to pass in the results data as a separate object from the
    // query. If we don't delete it here the URL explodes when we try to set it
    delete updated.result;

    actions.updateQuery(index, updated);
  };

  handleColumnChange = columnIndex => {
    const { actions, index, visibleColumns } = this.props;
    actions.setColumnStatus(index, columnIndex, !visibleColumns.getIn([columnIndex, 'status']));
  };

  render() {
    const { query, classes, visibleColumns } = this.props;
    const { visProps = {}, result } = query;
    let { rowsPerPage = 5 } = visProps;
    const { paginate = true, page = 0, orderBy = '', order = 'asc' } = visProps;

    // fit table to data
    if (result.data.length < rowsPerPage || paginate === false) {
      rowsPerPage = result.data.length;
    }
    const emptyRows = rowsPerPage - Math.min(rowsPerPage, result.data.length - page * rowsPerPage);

    const { highlightIndex } = result;

    const columns = result.columns.map((header, index) => {
      const headerKey = header;
      if ('disableSort' in result && result.disableSort.has(index)) {
        return <TableCell key={headerKey}>{header}</TableCell>;
      }
      return (
        <TableCell
          padding="dense"
          key={headerKey}
          sortDirection={orderBy === index ? order : false}
        >
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
        ? columns
        : columns.filter((column, i) => visibleColumns.getIn([i, 'status']));

    return (
      <div className={classes.root}>
        <div className={classes.scroll}>
          <ColumnSelection
            columns={visibleColumns}
            onChange={index => this.handleColumnChange(index)}
          />
          {paginate ? (
            <TablePagination
              component="div"
              count={result.data.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onChangePage={this.handleChangePage}
              onChangeRowsPerPage={this.handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
              ActionsComponent={TablePaginationActions}
            />
          ) : null}

          <Table padding="dense">
            <TableHead>
              <TableRow>{filteredColumns}</TableRow>
            </TableHead>
            <TableBody>
              {stableSort(result.data, getSorting(order, orderBy))
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  let rowStyle = {};
                  const currspot = page * rowsPerPage + index;
                  if (highlightIndex && currspot.toString() in highlightIndex) {
                    rowStyle = { backgroundColor: highlightIndex[currspot.toString()] };
                  }
                  const key = row.id || index;
                  const filteredRow =
                    visibleColumns.size === 0
                      ? row
                      : row.filter((column, i) => visibleColumns.getIn([i, 'status']));
                  return (
                    <TableRow hover key={key} style={rowStyle}>
                      {filteredRow.map((cell, i) => {
                        const cellKey = i;
                        if (cell && typeof cell === 'object' && 'value' in cell) {
                          if ('action' in cell) {
                            return (
                              <TableCell
                                padding="dense"
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
                        return <TableCell key={cellKey}>{cell}</TableCell>;
                      })}
                    </TableRow>
                  );
                })}
              {emptyRows > 0 && (
                <TableRow style={{ height: 48 * emptyRows }}>
                  <TableCell key="empty" colSpan={6} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
}

SimpleTable.propTypes = {
  query: PropTypes.object.isRequired,
  classes: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  visibleColumns: PropTypes.object.isRequired
};

export default withStyles(styles)(SimpleTable);
