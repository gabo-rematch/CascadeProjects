import React, { useState } from 'react';
import FileUpload from './FileUpload';
import MappingEditor from './MappingEditor';
import ImportRunner from './ImportRunner';

export default function ImportPage() {
  const [dataSource, setDataSource] = useState(null); // { type: 'file'/'url', file: File Object?, url: String?, fields: [...], content: String? }
  const [sourceFields, setSourceFields] = useState([]);
  const [targetTable, setTargetTable] = useState('wa_group_listings'); // Default for now
  const [mappingConfig, setMappingConfig] = useState({});
  const [importStep, setImportStep] = useState('upload'); // upload, map, run
  const [importStatus, setImportStatus] = useState(null); // null, 'success', 'error'
  const [importResult, setImportResult] = useState(null); // Holds success data or error message

  const handleDataSourceSelect = (selectedDataSource) => {
    if (selectedDataSource) {
      console.log('[ImportPage] handleDataSourceSelect received object:', JSON.stringify(selectedDataSource, null, 2));
      console.log('Data Source Selected:', selectedDataSource);
      setDataSource(selectedDataSource); // Store the whole object
      setSourceFields(selectedDataSource.fields || []);
      setMappingConfig({}); // Reset mapping when new file/url is selected
      setImportStep('map');
      setImportStatus(null); // Reset status for new import
      setImportResult(null);
    } else {
      // Handle clearing the selection
      setDataSource(null);
      setSourceFields([]);
      setMappingConfig({});
      setImportStep('upload');
    }
  };

  const handleMappingComplete = (config) => {
    console.log('[ImportPage] handleMappingComplete received:', config);
    setMappingConfig(config);
    setImportStep('run');
    console.log('[ImportPage] State updated. Step:', 'run', 'Mapping Config:', config);
  };

  // Called by ImportRunner on success
  const handleImportComplete = (result) => {
    console.log('Import successful in Parent:', result);
    setImportStatus('success');
    setImportResult(result); // Store the result object (e.g., { added: N, updated: M })
    // Optionally clear dataSource and mappingConfig here if desired after success
    // setDataSource(null);
    // setMappingConfig(null);
  };

  // Called by ImportRunner on error
  const handleImportError = (error) => {
    console.error('Import failed in Parent:', error);
    setImportStatus('error');
    setImportResult(error.message || 'An unknown error occurred during import.'); // Store the error message
  };

  const handleCancel = () => {
    // Allow user to go back from mapping or running
    setDataSource(null);
    setSourceFields([]);
    setMappingConfig({});
    setImportStep('upload');
  }

  const handleNewImport = () => {
    setImportStatus(null);
    setImportResult(null);
    setImportStep('upload');
  }

  // Log state just before rendering ImportRunner
  console.log('[ImportPage] Rendering state:', { importStep, dataSource: !!dataSource, mappingConfig: !!mappingConfig, importStatus });

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Import Data for '{targetTable}'</h1>

      {!importStatus ? (
        // Render Import Steps if status is null
        <>
          {importStep === 'upload' && (
            <FileUpload onDataSourceSelect={handleDataSourceSelect} targetTable={targetTable} />
          )}

          {importStep === 'map' && dataSource && (
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-2">Step 2: Map Fields</h2>
              {/* Log the props passed to MappingEditor */}
              {console.log('[ImportPage] Rendering MappingEditor with sourceFields:', sourceFields, 'targetTable:', targetTable)}
              <MappingEditor
                key={dataSource.file ? dataSource.file.name + dataSource.file.lastModified : dataSource.url} // Key to reset state on new source
                sourceFields={sourceFields}
                targetTable={targetTable}
                onMappingComplete={handleMappingComplete}
              />
              <button onClick={handleCancel} className="mt-4 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            </div>
          )}

          {importStep === 'run' && dataSource && mappingConfig && (
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-2">Step 3: Running Import</h2>
              <ImportRunner
                key={dataSource.file ? dataSource.file.name : dataSource.url} // Add key to force re-mount on new source
                file={dataSource.type === 'file' ? dataSource.file : null}
                // Pass url and content if type indicates a URL source
                url={dataSource.type?.includes('url') ? dataSource.url : null}
                content={dataSource.type?.includes('url') ? dataSource.content : null}
                targetTable={targetTable}
                mappingConfig={mappingConfig}
                onImportComplete={handleImportComplete}
                onImportError={handleImportError} // Pass error handler
              />
               <button onClick={handleCancel} className="mt-4 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            </div>
          )}
        </>
      ) : (
        // Render Confirmation Screen if status is 'success' or 'error'
        <div className="mt-4 p-6 border rounded shadow-md bg-white">
          <h2 className="text-xl font-semibold mb-4">Import Result</h2>
          {importStatus === 'success' && (
            <div className="p-4 bg-green-100 text-green-700 border border-green-200 rounded">
              <p className="font-semibold">Import Successful!</p>
              {/* Display results from importResult if it's an object */}
              {importResult && typeof importResult === 'object' && (
                  <p className="text-sm mt-1">Added: {importResult.added || 0}, Updated: {importResult.updated || 0}, Failed: {importResult.failed || 0}</p>
              )}
            </div>
          )}
          {importStatus === 'error' && (
            <div className="p-4 bg-red-100 text-red-700 border border-red-200 rounded">
              <p className="font-semibold">Import Failed!</p>
              {/* Display error message from importResult if it's a string */}
              <p className="text-sm mt-1">{typeof importResult === 'string' ? importResult : 'An unknown error occurred.'}</p>
            </div>
          )}
          <button
            onClick={handleNewImport}
            className="mt-6 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Start New Import
          </button>
        </div>
      )}
    </div>
  );
}
