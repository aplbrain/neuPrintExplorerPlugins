import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Modal from '@material-ui/core/Modal';
import Button from '@material-ui/core/Button';

const useStyles = makeStyles((theme) => ({
  paper: {
    position: 'absolute',
    width: '95%',
    height: '95%',
    backgroundColor: theme.palette.background.paper,
    border: '2px solid #000',
    boxShadow: theme.shadows[5],
    padding: theme.spacing(2, 4, 3),
    top: `50%`,
    left: `50%`,
    transform: `translate(-50%, -50%)`,
  },
}));

export default function ColumnSelectModal({ callback }) {
  const [open, setOpen] = useState(false);
  const classes = useStyles();

  const handleOpen = () => {
    setOpen(true);
    if (callback) {
      callback();
    }
  };

  return (
    <div>
      <Button color="primary" variant="outlined" onClick={handleOpen}>
        Column Selection
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="simple-modal-title"
        aria-describedby="simple-modal-description"
      >
        <div className={classes.paper}>
          <Button
            style={{ position: 'absolute', top: '5px', right: '5px' }}
            variant="outlined"
            onClick={() => setOpen(false)}
          >
            ✖︎ Close
          </Button>
          <h2>ME(R) column selector</h2>
          <p>
            Hold down your mouse button, drag it over the columns you are interested in, to
            highlight them. Once highlighted, copy the ids from the text area, close the modal, and
            paste them into the &quot;Input/Output Brain Regions&quot; selection menus.
          </p>

          <iframe
            style={{ border: 'none' }}
            width="100%"
            height="100%"
            src="/public/medulla_column_selector.html"
            title="Column selection"
          />
        </div>
      </Modal>
    </div>
  );
}

ColumnSelectModal.propTypes = {
  callback: PropTypes.func,
};

ColumnSelectModal.defaultProps = {
  callback: null,
};
