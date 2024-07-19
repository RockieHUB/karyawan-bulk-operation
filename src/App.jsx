import "./App.css";
// import { useState } from 'react'
import Navbar from "./components/Navbar";
import Tabel from "./components/DataGrid";
import { CssBaseline } from "@mui/material";

function App() {
  return (
    <>
      <CssBaseline />
      <Navbar />
      <Tabel />
    </>
  );
}

export default App;
