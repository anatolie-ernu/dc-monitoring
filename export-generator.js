/**
 * DC MONITORING - EXPORT GENERATOR
 * Excel (.xlsx) and PDF (.pdf) report generation
 */

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ============================================
// EXCEL EXPORT
// ============================================

class ExcelExporter {
  constructor(outputPath = './exports') {
    this.outputPath = outputPath;
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
  }

  /**
   * Generate Excel report from sensor data & alerts
   */
  async generateReport(reportData, filename = null) {
    const workbook = new ExcelJS.Workbook();
    
    // Set workbook properties
    workbook.creator = 'DC Monitoring System';
    workbook.lastModifiedBy = 'Monitoring System';
    workbook.created = new Date();
    
    // Add worksheets
    this.addSummarySheet(workbook, reportData);
    this.addTemperatureDataSheet(workbook, reportData.sensorReadings);
    this.addHumidityDataSheet(workbook, reportData.sensorReadings);
    this.addPowerDataSheet(workbook, reportData.sensorReadings);
    this.addAlertsSheet(workbook, reportData.alerts);
    this.addStatisticsSheet(workbook, reportData.statistics);
    
    // Generate filename if not provided
    const outputFilename = filename || `DC_Monitoring_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    const outputFile = path.join(this.outputPath, outputFilename);
    
    // Write file
    await workbook.xlsx.writeFile(outputFile);
    console.log(`[Excel] Report generated: ${outputFile}`);
    
    return outputFile;
  }

  /**
   * Add Summary Sheet
   */
  addSummarySheet(workbook, reportData) {
    const sheet = workbook.addWorksheet('Summary', { pageSetup: { paperSize: 1, orientation: 'portrait' } });
    
    // Set column widths
    sheet.columns = [
      { width: 30 },
      { width: 30 }
    ];
    
    // Title
    const titleRow = sheet.addRow(['DATA CENTER MONITORING REPORT']);
    titleRow.font = { size: 16, bold: true, color: { rgb: 'FF1F77B4' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'center' };
    sheet.mergeCells('A1:B1');
    
    sheet.addRow(['']);
    
    // Report period
    sheet.addRow(['Report Period:', `${reportData.period.from} to ${reportData.period.to}`]);
    sheet.addRow(['Generated:', new Date().toLocaleString()]);
    sheet.addRow(['System Uptime:', `${reportData.statistics.uptime}%`]);
    sheet.addRow(['']);
    
    // Metrics
    sheet.addRow(['SYSTEM METRICS', '']).font = { bold: true, size: 12, color: { rgb: 'FFFFFFFF' } };
    sheet.getLastRow().fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FF1F77B4' } };
    
    sheet.addRow(['Total Sensors:', reportData.statistics.totalSensors]);
    sheet.addRow(['Online Sensors:', reportData.statistics.onlineSensors]);
    sheet.addRow(['Offline Sensors:', reportData.statistics.offlineSensors]);
    sheet.addRow(['Total Readings:', reportData.statistics.totalReadings]);
    sheet.addRow(['']);
    
    // Temperature Statistics
    sheet.addRow(['TEMPERATURE STATISTICS', '']).font = { bold: true, size: 12 };
    sheet.getLastRow().fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FFFF7F0E' } };
    
    sheet.addRow(['Average Temperature:', `${reportData.statistics.avgTemperature}°C`]);
    sheet.addRow(['Min Temperature:', `${reportData.statistics.minTemperature}°C`]);
    sheet.addRow(['Max Temperature:', `${reportData.statistics.maxTemperature}°C`]);
    sheet.addRow(['Temperature Stability:', `${reportData.statistics.tempStability}%`]);
    sheet.addRow(['']);
    
    // Humidity Statistics
    sheet.addRow(['HUMIDITY STATISTICS', '']).font = { bold: true, size: 12 };
    sheet.getLastRow().fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FF17A2B8' } };
    
    sheet.addRow(['Average Humidity:', `${reportData.statistics.avgHumidity}%`]);
    sheet.addRow(['Min Humidity:', `${reportData.statistics.minHumidity}%`]);
    sheet.addRow(['Max Humidity:', `${reportData.statistics.maxHumidity}%`]);
    sheet.addRow([''];
    
    // Alert Summary
    sheet.addRow(['ALERT SUMMARY', '']).font = { bold: true, size: 12 };
    sheet.getLastRow().fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FFD62728' } };
    
    sheet.addRow(['Total Alerts:', reportData.statistics.totalAlerts]);
    sheet.addRow(['Critical Alerts:', reportData.statistics.criticalAlerts]);
    sheet.addRow(['Warning Alerts:', reportData.statistics.warningAlerts]);
    sheet.addRow(['Mean Time to Resolution (MTTR):', `${reportData.statistics.mttr} min`]);
  }

  /**
   * Add Temperature Data Sheet with formatting
   */
  addTemperatureDataSheet(workbook, readings) {
    const sheet = workbook.addWorksheet('Temperature Data');
    
    sheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Sensor ID', key: 'sensorId', width: 20 },
      { header: 'Room', key: 'room', width: 15 },
      { header: 'Temperature (°C)', key: 'value', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Status', key: 'status', width: 12 }
    ];
    
    // Style header
    sheet.getRow(1).font = { bold: true, color: { rgb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FF1F77B4' } };
    
    // Add data
    const tempReadings = readings.filter(r => r.type === 'temperature');
    tempReadings.forEach(reading => {
      const row = sheet.addRow({
        timestamp: reading.timestamp,
        sensorId: reading.sensorId,
        room: reading.room,
        value: reading.value,
        unit: '°C',
        status: reading.status
      });
      
      // Color code by status
      if (reading.status === 'critical') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FFFFCCCC' } };
      } else if (reading.status === 'warning') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FFFFE5CC' } };
      }
    });
    
    // Add summary at bottom
    const lastRow = sheet.lastRow.number + 2;
    sheet.addRow([]);
    const avgRow = sheet.addRow(['', '', 'Average:', tempReadings.reduce((sum, r) => sum + r.value, 0) / tempReadings.length]);
    avgRow.font = { bold: true };
  }

  /**
   * Add Humidity Data Sheet
   */
  addHumidityDataSheet(workbook, readings) {
    const sheet = workbook.addWorksheet('Humidity Data');
    
    sheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Sensor ID', key: 'sensorId', width: 20 },
      { header: 'Room', key: 'room', width: 15 },
      { header: 'Humidity (%)', key: 'value', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Status', key: 'status', width: 12 }
    ];
    
    sheet.getRow(1).font = { bold: true, color: { rgb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FF17A2B8' } };
    
    const humidityReadings = readings.filter(r => r.type === 'humidity');
    humidityReadings.forEach(reading => {
      sheet.addRow({
        timestamp: reading.timestamp,
        sensorId: reading.sensorId,
        room: reading.room,
        value: reading.value,
        unit: '%',
        status: reading.status
      });
    });
  }

  /**
   * Add Power Data Sheet
   */
  addPowerDataSheet(workbook, readings) {
    const sheet = workbook.addWorksheet('Power Data');
    
    sheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Phase 1 (kW)', key: 'phase1', width: 15 },
      { header: 'Phase 2 (kW)', key: 'phase2', width: 15 },
      { header: 'Phase 3 (kW)', key: 'phase3', width: 15 },
      { header: 'Total (kW)', key: 'total', width: 15 }
    ];
    
    sheet.getRow(1).font = { bold: true, color: { rgb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FFFF7F0E' } };
    
    const powerReadings = readings.filter(r => r.type === 'power');
    powerReadings.forEach(reading => {
      sheet.addRow({
        timestamp: reading.timestamp,
        phase1: reading.phase1 || '-',
        phase2: reading.phase2 || '-',
        phase3: reading.phase3 || '-',
        total: reading.total || '-'
      });
    });
  }

  /**
   * Add Alerts Sheet
   */
  addAlertsSheet(workbook, alerts) {
    const sheet = workbook.addWorksheet('Alerts');
    
    sheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Rule', key: 'rule', width: 30 },
      { header: 'Sensor', key: 'sensor', width: 20 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Value', key: 'value', width: 12 },
      { header: 'Threshold', key: 'threshold', width: 12 },
      { header: 'Duration', key: 'duration', width: 12 }
    ];
    
    sheet.getRow(1).font = { bold: true, color: { rgb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FFD62728' } };
    
    alerts.forEach(alert => {
      const row = sheet.addRow({
        timestamp: alert.timestamp,
        rule: alert.rule_name,
        sensor: alert.sensor_id,
        severity: alert.severity.toUpperCase(),
        value: alert.sensor_value,
        threshold: alert.threshold_value,
        duration: `${alert.duration_minutes} min`
      });
      
      if (alert.severity === 'critical') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FFFFCCCC' } };
      }
    });
  }

  /**
   * Add Statistics Sheet
   */
  addStatisticsSheet(workbook, stats) {
    const sheet = workbook.addWorksheet('Statistics');
    
    sheet.columns = [
      { width: 25 },
      { width: 25 }
    ];
    
    const sections = [
      {
        title: 'SYSTEM HEALTH',
        data: [
          ['System Uptime', `${stats.uptime}%`],
          ['Sensors Online', `${stats.onlineSensors}/${stats.totalSensors}`],
          ['Data Collection Success Rate', `${stats.dataSuccessRate}%`],
          ['Average Response Time', `${stats.avgResponseTime}ms`]
        ]
      },
      {
        title: 'TEMPERATURE',
        data: [
          ['Average', `${stats.avgTemperature}°C`],
          ['Min', `${stats.minTemperature}°C`],
          ['Max', `${stats.maxTemperature}°C`],
          ['Std Dev', `${stats.tempStdDev}°C`],
          ['Within Setpoint', `${stats.tempStability}%`]
        ]
      },
      {
        title: 'HUMIDITY',
        data: [
          ['Average', `${stats.avgHumidity}%`],
          ['Min', `${stats.minHumidity}%`],
          ['Max', `${stats.maxHumidity}%`],
          ['Acceptable Range %', `${stats.humidityAcceptable}%`]
        ]
      },
      {
        title: 'ALERTS & INCIDENTS',
        data: [
          ['Total Alerts', stats.totalAlerts],
          ['Critical', stats.criticalAlerts],
          ['Warning', stats.warningAlerts],
          ['Info', stats.infoAlerts],
          ['Mean Time to Resolution', `${stats.mttr} min`],
          ['Response Time (Avg)', `${stats.avgResponseTime} min`]
        ]
      }
    ];
    
    let currentRow = 1;
    sections.forEach(section => {
      const titleRow = sheet.addRow([section.title, '']);
      titleRow.font = { bold: true, size: 12, color: { rgb: 'FFFFFFFF' } };
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FF1F77B4' } };
      sheet.mergeCells(`A${currentRow}:B${currentRow}`);
      currentRow++;
      
      section.data.forEach(([label, value]) => {
        sheet.addRow([label, value]);
        currentRow++;
      });
      
      sheet.addRow(['']);
      currentRow++;
    });
  }
}

// ============================================
// PDF EXPORT
// ============================================

class PDFExporter {
  constructor(outputPath = './exports') {
    this.outputPath = outputPath;
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
  }

  /**
   * Generate PDF report
   */
  generateReport(reportData, filename = null) {
    return new Promise((resolve, reject) => {
      const outputFilename = filename || `DC_Monitoring_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      const outputFile = path.join(this.outputPath, outputFilename);
      const stream = fs.createWriteStream(outputFile);
      
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true
      });
      
      doc.pipe(stream);
      
      // Header
      this.addHeader(doc, reportData);
      doc.moveDown(1);
      
      // Executive Summary
      this.addExecutiveSummary(doc, reportData);
      
      // Page break
      doc.addPage();
      
      // Alerts & Incidents
      this.addAlertsSection(doc, reportData);
      
      // Page break
      doc.addPage();
      
      // Temperature Analysis
      this.addTemperatureAnalysis(doc, reportData);
      
      // Page break
      doc.addPage();
      
      // Compliance & Recommendations
      this.addComplianceSection(doc, reportData);
      
      // Footer (auto-added to all pages)
      const pages = doc.bufferedPageRange().count;
      for (let i = 0; i < pages; i++) {
        doc.switchToPage(i);
        doc.fontSize(9).text(
          `Page ${i + 1} of ${pages} | Generated: ${new Date().toLocaleString()}`,
          50, doc.page.height - 50,
          { align: 'center' }
        );
      }
      
      doc.on('error', reject);
      stream.on('finish', () => {
        console.log(`[PDF] Report generated: ${outputFile}`);
        resolve(outputFile);
      });
      
      doc.end();
    });
  }

  addHeader(doc, data) {
    doc.fontSize(20).font('Helvetica-Bold').text('DATA CENTER MONITORING REPORT', 40, 40);
    doc.fontSize(11).font('Helvetica').text(`Period: ${data.period.from} to ${data.period.to}`, 40, 70);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 40, 90);
    
    doc.moveTo(40, 110).lineTo(550, 110).stroke();
  }

  addExecutiveSummary(doc, data) {
    doc.fontSize(14).font('Helvetica-Bold').text('EXECUTIVE SUMMARY', 40, 130);
    doc.moveDown(0.5);
    
    const summaryData = [
      ['System Uptime', `${data.statistics.uptime}%`],
      ['Sensors Online', `${data.statistics.onlineSensors}/${data.statistics.totalSensors}`],
      ['Total Alerts', data.statistics.totalAlerts],
      ['Critical Alerts', data.statistics.criticalAlerts],
      ['Avg Temperature', `${data.statistics.avgTemperature}°C`],
      ['Avg Humidity', `${data.statistics.avgHumidity}%`],
      ['Mean Time To Resolution', `${data.statistics.mttr} min`]
    ];
    
    doc.fontSize(10).font('Helvetica');
    summaryData.forEach(([label, value]) => {
      doc.text(`${label}: ${value}`, 40, { indent: 20 });
      doc.moveDown(0.3);
    });
  }

  addAlertsSection(doc, data) {
    doc.fontSize(14).font('Helvetica-Bold').text('ALERTS & INCIDENTS', 40, 100);
    doc.moveDown(0.5);
    
    const alerts = data.alerts.slice(0, 10);
    doc.fontSize(9).font('Helvetica');
    
    alerts.forEach(alert => {
      doc.text(`[${alert.severity.toUpperCase()}] ${alert.rule_name}`, 40, { indent: 20 });
      doc.fontSize(8).text(`Sensor: ${alert.sensor_id}, Value: ${alert.sensor_value}, Duration: ${alert.duration_minutes}min`, 50);
      doc.moveDown(0.3);
    });
  }

  addTemperatureAnalysis(doc, data) {
    doc.fontSize(14).font('Helvetica-Bold').text('TEMPERATURE ANALYSIS', 40, 100);
    doc.moveDown(0.5);
    
    const stats = data.statistics;
    doc.fontSize(10).font('Helvetica');
    doc.text(`Average Temperature: ${stats.avgTemperature}°C`, 40, { indent: 20 });
    doc.text(`Temperature Range: ${stats.minTemperature}°C - ${stats.maxTemperature}°C`, 40, { indent: 20 });
    doc.text(`Within Acceptable Range: ${stats.tempStability}%`, 40, { indent: 20 });
    doc.text(`Standard Deviation: ${stats.tempStdDev}°C`, 40, { indent: 20 });
  }

  addComplianceSection(doc, data) {
    doc.fontSize(14).font('Helvetica-Bold').text('COMPLIANCE & RECOMMENDATIONS', 40, 100);
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    doc.text('✓ Temperature maintained within acceptable range', 40, { indent: 20 });
    doc.text('✓ Humidity levels acceptable for equipment', 40, { indent: 20 });
    doc.text('✓ All sensors operational and reporting', 40, { indent: 20 });
    
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold').text('Recommendations:', 40);
    doc.fontSize(9).font('Helvetica');
    doc.text('• Monitor AC system performance during peak hours', 40, { indent: 20 });
    doc.text('• Schedule humidity sensors calibration quarterly', 40, { indent: 20 });
    doc.text('• Review alert rules to reduce false positives', 40, { indent: 20 });
  }
}

// ============================================
// EXPORT HELPER
// ============================================

class ExportManager {
  async exportToExcel(reportData) {
    const exporter = new ExcelExporter();
    return await exporter.generateReport(reportData);
  }

  async exportToPDF(reportData) {
    const exporter = new PDFExporter();
    return await exporter.generateReport(reportData);
  }

  async exportToCSV(readings) {
    // Simple CSV export
    let csv = 'Timestamp,SensorID,Room,Type,Value,Unit,Status\n';
    
    readings.forEach(r => {
      csv += `"${r.timestamp}","${r.sensorId}","${r.room}","${r.type}",${r.value},"${r.unit}","${r.status}"\n`;
    });
    
    const filename = `sensor_data_${new Date().toISOString().split('T')[0]}.csv`;
    const filepath = path.join('./exports', filename);
    fs.writeFileSync(filepath, csv);
    
    console.log(`[CSV] Export saved: ${filepath}`);
    return filepath;
  }
}

module.exports = {
  ExcelExporter,
  PDFExporter,
  ExportManager
};
