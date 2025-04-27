import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { XMLParser } from 'fast-xml-parser';
import { getSupabaseClient } from '../../supabaseClient';

const supabase = getSupabaseClient();

export default function FileUpload({ onDataSourceSelect, targetTable }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [xmlUrl, setXmlUrl] = useState(''); // State for URL input
  const [isLoadingUrl, setIsLoadingUrl] = useState(false); // State for URL loading indicator
  const [isLoading, setIsLoading] = useState(false);

  const handleDragEnter = (event) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragging(false);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    // Reset input value to allow uploading the same file again
    event.target.value = null;
  };

  // Function to process an uploaded file
  const processFile = async (file) => {
    setError('');
    setFileName(file.name);
    setXmlUrl(''); // Clear URL if a file is processed

    try {
      const fileText = await file.text();
      let sourceFields = [];

      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        // Parse CSV
        const result = Papa.parse(fileText, { header: true, skipEmptyLines: true, preview: 1 });
        if (result.errors.length > 0) {
          throw new Error(`CSV Parsing Error: ${result.errors[0].message}`);
        }
        if (!result.meta || !result.meta.fields || result.meta.fields.length === 0) {
          throw new Error('Could not detect headers in CSV file.');
        }
        sourceFields = result.meta.fields;
      } else if (file.name.toLowerCase().endsWith('.xml')) {
        // Parse XML
        const parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true, parseAttributeValue: true, parseTagValue: true });
        const jsonObj = parser.parse(fileText);

        // Try to find the first repeating element that likely represents a record
        // This is heuristic and might need adjustment based on actual XML structures
        let firstRecord = null;
        if (jsonObj.Listings && jsonObj.Listings.Listing) {
          // Handle structure like <Listings><Listing>...</Listing></Listings>
          firstRecord = Array.isArray(jsonObj.Listings.Listing) ? jsonObj.Listings.Listing[0] : jsonObj.Listings.Listing;
        } else if (Array.isArray(jsonObj[Object.keys(jsonObj)[0]])) {
          // Handle structure like <Root><Item>...</Item></Root>
          firstRecord = jsonObj[Object.keys(jsonObj)[0]][0];
        } else if (typeof jsonObj[Object.keys(jsonObj)[0]] === 'object'){
          // Fallback: Assume root contains the record object directly or nested
          let potentialRecordContainer = jsonObj[Object.keys(jsonObj)[0]];
          // Check if the container itself is the record or contains the first record
          firstRecord = potentialRecordContainer[Object.keys(potentialRecordContainer)[0]];
        }

        if (firstRecord && typeof firstRecord === 'object') {
          sourceFields = Object.keys(firstRecord);
        } else {
          throw new Error('Could not automatically detect record structure in XML. Ensure file has repeating elements representing records.');
        }
      } else {
        throw new Error('Unsupported file type. Please upload CSV or XML.');
      }

      if (sourceFields.length > 0) {
        onDataSourceSelect({ type: 'file', file: file, fields: sourceFields }); // Pass file object and fields to parent
      } else {
        throw new Error('No fields detected in the file.');
      }
    } catch (err) {
      console.error('File processing error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlLoad = async () => {
    setError('');
    setIsLoadingUrl(true);
    setFileName(''); // Clear file name when loading URL

    try {
      console.log(`Invoking Supabase function 'fetch-external-feed' for URL: ${xmlUrl}`);
      const { data: functionResult, error: functionError } = await supabase.functions.invoke('fetch-external-feed', {
        body: { url: xmlUrl },
      });

      if (functionError) {
        throw new Error(`Supabase function error: ${functionError.message}`);
      }

      if (functionResult.error) {
        throw new Error(`Feed fetch error: ${functionResult.error}`);
      }

      if (!functionResult.success || !functionResult.content) {
        throw new Error('Failed to retrieve content from the feed URL via proxy.');
      }

      const xmlText = functionResult.content;

      console.log('Parsing XML content received from function...');
      const parser = new XMLParser({
        ignoreAttributes: false, // Keep attributes
        allowBooleanAttributes: true, // Allow boolean attributes
        parseAttributeValue: true, // Parse attribute values
        parseTagValue: true // Parse tag values
      });
      const jsonObj = parser.parse(xmlText);

      // Try to find the first repeating element that likely represents a record
      // This is heuristic and might need adjustment based on actual XML structures
      let firstRecord = null;
      if (jsonObj.Listings && jsonObj.Listings.Listing) {
        // Handle structure like <Listings><Listing>...</Listing></Listings>
        firstRecord = Array.isArray(jsonObj.Listings.Listing) ? jsonObj.Listings.Listing[0] : jsonObj.Listings.Listing;
      } else if (Array.isArray(jsonObj[Object.keys(jsonObj)[0]])) {
        // Handle structure like <Root><Item>...</Item></Root>
        firstRecord = jsonObj[Object.keys(jsonObj)[0]][0];
      } else if (typeof jsonObj[Object.keys(jsonObj)[0]] === 'object'){
        // Fallback: Assume root contains the record object directly or nested
        let potentialRecordContainer = jsonObj[Object.keys(jsonObj)[0]];
        // Check if the container itself is the record or contains the first record
        firstRecord = potentialRecordContainer[Object.keys(potentialRecordContainer)[0]];
      }

      if (firstRecord && typeof firstRecord === 'object') {
        const sourceFields = Object.keys(firstRecord);
        const dataSource = {
          type: 'xml-url',
          url: xmlUrl,
          fields: sourceFields,
          content: xmlText
        };

        // Log the object being sent up
        console.log('[FileUpload] Calling onDataSourceSelect with URL data:', dataSource);

        onDataSourceSelect(dataSource);
      } else {
        throw new Error('Could not automatically detect record structure in XML. Ensure file has repeating elements representing records.');
      }
    } catch (err) {
      console.error('URL processing error:', err);
      setError(`Error processing URL: ${err.message}`);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleClear = () => {
    setError('');
    setFileName('');
    setXmlUrl('');
    setIsLoadingUrl(false);
    if (onDataSourceSelect) {
      onDataSourceSelect(null); // Notify parent that selection is cleared
    }
    // Reset the file input visually if needed (might require ref)
    const fileInput = document.getElementById('file-upload-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Upload CSV/XML File or Enter XML URL
      </label>

      {/* File Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'} border-dashed rounded-md transition-colors duration-150 ease-in-out`}
      >
        <div className="space-y-1 text-center">
          {/* Icon (optional) */}
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex text-sm text-gray-600">
            <label
              htmlFor="file-upload-input"
              className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
            >
              <span>Upload a file</span>
              <input id="file-upload-input" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".csv, .xml" />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-gray-500">CSV or XML</p>
        </div>
      </div>

      {/* OR Separator */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-2 bg-white text-sm text-gray-500">OR</span>
        </div>
      </div>

      {/* URL Input Area */}
      <div className="flex items-center space-x-2">
        <input
          type="url"
          value={xmlUrl}
          onChange={(e) => { setXmlUrl(e.target.value); setFileName(''); setError(''); }} // Clear file name on URL input
          placeholder="Enter XML Feed URL (e.g., https://example.com/feed.xml)"
          className="flex-grow shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          disabled={isLoadingUrl}
        />
        <button
          onClick={handleUrlLoad}
          disabled={!xmlUrl || isLoadingUrl}
          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingUrl ? 'Loading...' : 'Load from URL'}
        </button>
      </div>

      {/* Display File/URL Name and Error/Clear Button */}
      {(fileName || xmlUrl) && !error && (
        <div className="mt-3 text-sm text-gray-700 flex justify-between items-center">
          <span>Selected: <span className="font-medium">{fileName || xmlUrl}</span></span>
          <button onClick={handleClear} className="text-red-600 hover:text-red-800 text-xs font-medium">Clear</button>
        </div>
      )}
      {error && (
        <div className="mt-3 text-sm text-red-600 flex justify-between items-center">
          <p>Error: {error}</p>
          <button onClick={handleClear} className="text-red-600 hover:text-red-800 text-xs font-medium">Clear</button>
        </div>
      )}
    </div>
  );
}
