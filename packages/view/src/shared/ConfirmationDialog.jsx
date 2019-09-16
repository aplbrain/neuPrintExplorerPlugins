import React from 'react';
import PropTypes from 'prop-types';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Dialog from '@material-ui/core/Dialog';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import Checkbox from '@material-ui/core/Checkbox';

class ConfirmationDialog extends React.Component {
  handleOk = () => {
    const { onConfirm } = this.props;
    onConfirm();
  };

  handleToggle = (index) => {
    const { onChange } = this.props;
    onChange(index);
  };

  render() {
    const { open, columns } = this.props;

    if (!open) {
      return null;
    }

    const options = columns.map((column, index) => (
      <ListItem key={column[0]} button onClick={() => this.handleToggle(index)}>
          <ListItemText primary={`${column[0]}`} />
          <ListItemSecondaryAction>
            <Checkbox
              color="primary"
              onChange={() => this.handleToggle(index)}
              checked={column[1]}
            />
          </ListItemSecondaryAction>
        </ListItem>
    ));

    return (
      <Dialog
        maxWidth="xs"
        aria-labelledby="confirmation-dialog-title"
        open={open}
        onClose={this.handleOk}
      >
        <DialogTitle id="confirmation-dialog-title">Column Selection</DialogTitle>
        <DialogContent>
          <List>
            {options}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleOk} color="primary">
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}

ConfirmationDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  columns: PropTypes.arrayOf(PropTypes.array).isRequired,
  onConfirm: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired
};

export default ConfirmationDialog;