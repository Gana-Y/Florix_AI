// src/utils/pdfExport.js
import html2pdf from 'html2pdf.js';

export const exportToPDF = (elementId, fileName = 'document') => {
  const element = document.getElementById(elementId);
  
  if (!element) {
    alert(`Error: Element with id '${elementId}' not found!`);
    return;
  }

  const opt = {
    margin:       [10, 10, 10, 10], // Top, Left, Bottom, Right margins
    filename:     `${fileName}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true }, // Higher scale = better quality
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // Generate the PDF
  html2pdf().set(opt).from(element).save();
};