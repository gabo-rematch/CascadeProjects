import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import MatchingPage from "./components/MatchingPage";
import ClientRequirementsTable from "./components/ClientRequirementsTable";
import ListingsTable from "./components/ListingsTable";
import ImportPage from "./components/import/ImportPage";

function Placeholder({ title }) {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      <p className="text-muted-foreground">This page is under construction.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-screen bg-background">
          <Routes>
            <Route path="/matching" element={<MatchingPage />} />
            <Route path="/matches" element={<Placeholder title="Matches" />} />
            <Route path="/client-requirements" element={<ClientRequirementsTable />} />
            <Route path="/listings" element={<ListingsTable />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="*" element={<Placeholder title="Matching" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
