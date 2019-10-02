import React from 'react';
import PropTypes from 'prop-types';

import Typography from '@material-ui/core/Typography';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import TablePagination from '@material-ui/core/TablePagination';
import { withStyles } from '@material-ui/core/styles';
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

// eslint-disable-next-line import/no-unresolved
import TablePaginationActions from '@neuprint/support';
import IndependentTable from './visualization/IndependentTable';
import ColumnSelection from './shared/ColumnSelection';

const styles = theme => ({
  root: {},
  clickable: {
    cursor: 'pointer'
  },
  nopad: {
    padding: 0
  },
  cellborder: {
    borderBottom: 0
  },
  scroll: {
    width: '100%',
    marginTop: theme.spacing.unit * 1,
    overflowY: 'auto',
    overflowX: 'auto',
    height: '100%'
  },
  expandButton: {
    left: '5px',
    right: 'auto',
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%) rotate(0deg)',
    transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms'
  },
  expansionText: {
    margin: '0 0 0 20px'
  }
});

class CollapsibleTable extends React.Component {
  handleChangePage = (event, page) => {
    const { query, actions, index } = this.props;
    const { visProps } = query;
    const newVisProps = Object.assign({}, visProps, { page });

    actions.updateQuery(index, Object.assign({}, query, { visProps: newVisProps }));
  };

  handleChangeRowsPerPage = event => {
    const { query, actions, index } = this.props;
    const { visProps } = query;
    const newVisProps = Object.assign({}, visProps, { rowsPerPage: event.target.value });

    actions.updateQuery(index, Object.assign({}, query, { visProps: newVisProps }));
  };

  handleCellClick = action => () => {
    action();
  };

  renderSingle() {
    const { query, classes, visibleColumns } = this.props;
    const row = query.result.data[0];
    return (
      <div className={classes.root}>
        <Typography className={classes.expansionText}>{row.name}</Typography>
        <div className={classes.scroll}>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className={classes.cellborder} padding="none">
                  <ColumnSelection
                    columns={visibleColumns}
                    onChange={columnIndex => this.handleColumnChange(columnIndex)}
                  />
                  <IndependentTable
                    data={row.data}
                    columns={row.columns}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );

  }

  render() {
    const { query, classes, visibleColumns } = this.props;
    const { visProps = {} } = query;
    let { rowsPerPage = 5 } = visProps;
    const { paginate = true, page = 0, paginateExpansion = false } = visProps;

    const emptyRows =
      rowsPerPage - Math.min(rowsPerPage, query.result.data.length - page * rowsPerPage);

    // if there is only one result, then we don't need pagination or the expansion panels.
    if (query.result.data.length === 1) {
      return this.renderSingle();
    }

    // fit table to data
    if (query.result.data.length < rowsPerPage || paginate === false) {
      rowsPerPage = query.result.data.length;
    }

    const { highlightIndex } = query.result;

    return (
      <div className={classes.root}>
        <div className={classes.scroll}>
          <Table>
            <TableBody>
              {query.result.data
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  let rowStyle = {};
                  const currspot = page * rowsPerPage + index;
                  const rowIndex = `${row.name}${index}`;
                  if (highlightIndex && currspot.toString() in highlightIndex) {
                    rowStyle = { backgroundColor: highlightIndex[currspot.toString()] };
                  }
                  return (
                    <TableRow hover key={rowIndex} style={rowStyle}>
                      <TableCell className={classes.cellborder} padding="none">
                        <ExpansionPanel>
                          <ExpansionPanelSummary
                            classes={{
                              expandIcon: classes.expandButton
                            }}
                            expandIcon={<ExpandMoreIcon />}
                          >
                            <Typography className={classes.expansionText}>{row.name}</Typography>
                          </ExpansionPanelSummary>
                          <ExpansionPanelDetails className={classes.nopad}>
                            <ColumnSelection
                              columns={visibleColumns}
                              onChange={columnIndex => this.handleColumnChange(columnIndex)}
                            />
                            <IndependentTable
                              data={row.data}
                              columns={row.columns}
                              paginate={paginateExpansion.valueOf()}
                            />
                          </ExpansionPanelDetails>
                        </ExpansionPanel>
                      </TableCell>
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
        {paginate ? (
          <TablePagination
            component="div"
            count={query.result.data.length}
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

CollapsibleTable.propTypes = {
  query: PropTypes.object.isRequired,
  classes: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  visibleColumns: PropTypes.object.isRequired
};

export default withStyles(styles)(CollapsibleTable);
