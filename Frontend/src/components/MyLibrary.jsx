import React, { useState } from 'react';
import { FileText, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import api from '../utils/api';

const MyLibrary = ({ onSelectFile }) => {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/upload", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.summary) {
        const newFile = {
          id: response.data.id,
          name: response.data.filename,
          size: "Uploaded",
          added: new Date().toISOString().split('T')[0],
          summary: response.data.summary,
          full_summary: response.data.summary,
        };
        setFiles([newFile, ...files]);
      }
    } catch (error) {
      alert("Upload failed: " + (error.response?.data?.detail || error.response?.data?.error || ""));
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (id) => {
    try {
      await api.delete(`/library/${id}`);
      setFiles(files.filter(f => f.id !== id));
    } catch (e) {
      alert("Failed to delete file.");
    }
  };

  return (
    <div className="p-8 min-h-screen dark:bg-zinc-900">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">My Library</h1>

        <label className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
          {isUploading ? <Loader2 className="animate-spin" size={20}/> : <Plus size={20} />}
          {isUploading ? "Processing AI..." : "Upload Document / Image"}
          <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.docx,.doc,.txt,.md,image/*" disabled={isUploading}/>
        </label>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
          <FileText size={48} className="text-slate-300 mb-4" />
          <p className="text-slate-500 dark:text-zinc-400 font-medium">No files yet. Upload a PDF to start studying!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {files.map((file) => (
            <div key={file.id} className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-slate-100 dark:border-zinc-700 hover:border-indigo-500 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                  <FileText size={24} />
                </div>
                <button onClick={() => deleteFile(file.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 size={20} />
                </button>
              </div>

              <h3 className="font-bold text-slate-800 dark:text-white mb-1 truncate">{file.name}</h3>
              <p className="text-xs text-slate-400 mb-6">{file.size || ''} • {file.added || ''}</p>

              <button
                onClick={() => onSelectFile(file)}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
              >
                Start Study Session <ExternalLink size={16}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyLibrary;
