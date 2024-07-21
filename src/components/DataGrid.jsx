import * as React from "react";
import {
  DataGrid,
  useGridApiRef,
  GridActionsCellItem,
  gridClasses,
} from "@mui/x-data-grid";
import { Snackbar, Alert } from "@mui/material";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import RestoreIcon from "@mui/icons-material/Restore";
import LoadingButton from "@mui/lab/LoadingButton";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import { darken } from "@mui/material/styles";
import axios from "axios";

export default function BulkEditing() {
  const apiRef = useGridApiRef();
  const autosaveTimeout = React.useRef(null);
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [hasUnsavedRows, setHasUnsavedRows] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const unsavedChangesRef = React.useRef({
    unsavedRows: {},
    rowsBeforeChange: {},
    newRows: [],
    deletedRows: [],
  });

  React.useEffect(() => {
    fetchData();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = async () => {
    try {
      const response = await axios.get(
        "http://localhost:8080/karyawan/batch-read"
      );
      setRows(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const columns = React.useMemo(() => {
    if (rows.length === 0) return [];

    const excludeFields = ["karyawanId"];
    const baseColumns = Object.keys(rows[0])
      .filter((key) => !excludeFields.includes(key))
      .map((key) => ({
        field: key,
        headerName: key.charAt(0).toUpperCase() + key.slice(1),
        flex: 1,
        editable: true,
      }));

    return [
      ...baseColumns,
      {
        field: "actions",
        type: "actions",
        headerName: "Actions",
        width: 100,
        cellClassName: "actions",
        getActions: ({ id }) => {
          return [
            // eslint-disable-next-line react/jsx-key
            <GridActionsCellItem
              icon={<DeleteIcon />}
              label="Delete"
              onClick={() => handleDeleteClick(id)}
              color="inherit"
            />,
          ];
        },
      },
    ];
  }, [rows]);

  const saveChanges = React.useCallback(async () => {
    try {
      setIsSaving(true);

      const rowsToCreate = unsavedChangesRef.current.newRows.map(
        ({ karyawanName, karyawanAddress, karyawanPhoneNumber }) => ({
          karyawanName,
          karyawanAddress,
          karyawanPhoneNumber,
        })
      );

      const rowsToUpdate = Object.values(unsavedChangesRef.current.unsavedRows)
        .filter((row) => !row.isNew) // Exclude new rows
        .map(
          ({
            karyawanId,
            karyawanName,
            karyawanAddress,
            karyawanPhoneNumber,
          }) => ({
            karyawanId,
            karyawanName,
            karyawanAddress,
            karyawanPhoneNumber,
          })
        );

      console.log("Rows to create:", rowsToCreate);
      console.log("Rows to update:", rowsToUpdate);

      if (rowsToCreate.length > 0) {
        try {
          const createResponse = await axios.post(
            "http://localhost:8080/karyawan/batch-create",
            rowsToCreate
          );
          console.log("Create response:", createResponse.data);
        } catch (error) {
          console.error(
            "Error in batch create:",
            error.response ? error.response.data : error.message
          );
          throw error;
        }
      }

      if (rowsToUpdate.length > 0) {
        try {
          const updateResponse = await axios.put(
            "http://localhost:8080/karyawan/batch-update",
            rowsToUpdate
          );
          console.log("Update response:", updateResponse.data);
        } catch (error) {
          console.error(
            "Error in batch update:",
            error.response ? error.response.data : error.message
          );
          throw error;
        }
      }

      // Add delete logic
      if (unsavedChangesRef.current.deletedRows.length > 0) {
        const idsToDelete = unsavedChangesRef.current.deletedRows;
        console.log("Rows to delete:", idsToDelete);

        try {
          const deleteResponse = await axios.delete(
            "http://localhost:8080/karyawan/batch-delete",
            { data: idsToDelete } // Send the array in a data object
          );
          console.log("Delete response:", deleteResponse.data);
        } catch (error) {
          console.error(
            "Error in batch delete:",
            error.response ? error.response.data : error.message
          );
          throw error;
        }
      }

      // Refetch data to get updated rows with new IDs
      await fetchData();

      setIsSaving(false);
      setHasUnsavedRows(false);
      unsavedChangesRef.current = {
        unsavedRows: {},
        rowsBeforeChange: {},
        newRows: [],
        deletedRows: [],
      };
      setSnackbarOpen(true);
    } catch (error) {
      console.error("Error saving changes:", error);
      setIsSaving(false);
      // You might want to show an error message to the user here
    }
  }, [fetchData]);

  const processRowUpdate = React.useCallback(
    (newRow, oldRow) => {
      const rowId = newRow.karyawanId;

      setRows((prevRows) =>
        prevRows.map((row) => (row.karyawanId === rowId ? newRow : row))
      );

      if (oldRow.isNew) {
        unsavedChangesRef.current.newRows =
          unsavedChangesRef.current.newRows.map((row) =>
            row.karyawanId === rowId ? newRow : row
          );
      } else {
        unsavedChangesRef.current.unsavedRows[rowId] = newRow;
        if (!unsavedChangesRef.current.rowsBeforeChange[rowId]) {
          unsavedChangesRef.current.rowsBeforeChange[rowId] = oldRow;
        }
      }
      setHasUnsavedRows(true);
      // Autosave Logic
      clearTimeout(autosaveTimeout.current);
      autosaveTimeout.current = setTimeout(() => {
        console.log("Autosaving triggered");
        saveChanges(); // Trigger the saveChanges function
      }, 5000); // Autosave after 5 seconds of inactivity
      return newRow;
    },
    [saveChanges]
  );

  const handleDeleteClick = (id) => {
    unsavedChangesRef.current.deletedRows.push(id);
    setHasUnsavedRows(true);
    setRows((prevRows) =>
      prevRows.map((row) =>
        row.karyawanId === id ? { ...row, _action: "delete" } : row
      )
    );
  };

  const discardChanges = React.useCallback(() => {
    setHasUnsavedRows(false);
    Object.values(unsavedChangesRef.current.rowsBeforeChange).forEach((row) => {
      apiRef.current.updateRows([row]);
    });
    unsavedChangesRef.current = {
      unsavedRows: {},
      rowsBeforeChange: {},
      newRows: [],
      deletedRows: [],
    };
    setRows((rows) =>
      rows
        .filter((row) => !row.isNew)
        .map((row) => {
          // eslint-disable-next-line no-unused-vars
          const { _action, ...rest } = row;
          return rest;
        })
    );
  }, [apiRef]);

  const getRowClassName = React.useCallback(({ row }) => {
    if (row._action === "delete") return "row--removed";
    if (row.isNew) return "row--new";
    const unsavedRow = unsavedChangesRef.current.unsavedRows[row.karyawanId];
    if (unsavedRow) return "row--edited";
    return "";
  }, []);

  const handleAddRow = () => {
    const newRow = {
      karyawanId: `new-${Date.now()}`, // Temporary ID
      karyawanName: "New Employee",
      karyawanAddress: "New Address",
      karyawanPhoneNumber: "",
      isNew: true, // Flag to identify new rows
    };
    setRows((prevRows) => [...prevRows, newRow]);
    unsavedChangesRef.current.newRows.push(newRow);
    setHasUnsavedRows(true);
  };

  const handleCellEditStop = () => {
    autosaveTimeout.current = setTimeout(saveChanges, 5000);
    console.log("Autosave Triggered");
  };

  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const handleSnackbarClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setSnackbarOpen(false);
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: 8 }}>
        <LoadingButton
          disabled={!hasUnsavedRows}
          loading={isSaving}
          onClick={saveChanges}
          startIcon={<SaveIcon />}
          loadingPosition="start"
        >
          <span>Save</span>
        </LoadingButton>
        <Button
          disabled={!hasUnsavedRows || isSaving}
          onClick={discardChanges}
          startIcon={<RestoreIcon />}
        >
          Discard all changes
        </Button>
        <Button
          variant="contained"
          onClick={handleAddRow}
          startIcon={<AddIcon />}
        >
          Add Row
        </Button>
      </div>
      <div style={{ height: 400 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          apiRef={apiRef}
          loading={loading}
          disableRowSelectionOnClick
          processRowUpdate={processRowUpdate}
          editMode="cell"
          getRowId={(row) => row.karyawanId}
          onCellEditStart={() => clearTimeout(autosaveTimeout.current)}
          onCellEditStop={handleCellEditStop}
          sx={{
            [`& .${gridClasses.row}.row--removed`]: {
              backgroundColor: (theme) =>
                theme.palette.mode === "light"
                  ? "rgba(255, 170, 170, 0.3)"
                  : darken("rgba(255, 170, 170, 1)", 0.7),
              textDecoration: "line-through",
            },
            [`& .${gridClasses.row}.row--edited`]: {
              backgroundColor: (theme) =>
                theme.palette.mode === "light"
                  ? "rgba(255, 254, 176, 0.3)"
                  : darken("rgba(255, 254, 176, 1)", 0.6),
            },
            [`& .${gridClasses.row}.row--new`]: {
              backgroundColor: (theme) =>
                theme.palette.mode === "light"
                  ? "rgba(170, 255, 170, 0.3)"
                  : darken("rgba(170, 255, 170, 1)", 0.7),
            },
          }}
          getRowClassName={getRowClassName}
        />
      </div>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity="success">
          Changes saved automatically
        </Alert>
      </Snackbar>
    </div>
  );
}
