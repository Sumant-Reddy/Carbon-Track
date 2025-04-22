const puppeteer = require('puppeteer');
const { format } = require('date-fns');
const logger = require('../utils/logger');
const { uploadFile } = require('./cloudinary.service');

/**
 * Generate an emissions report PDF
 * @param {Object} data - Report data
 * @param {Object} options - Report options
 * @returns {Promise<string>} URL of the generated PDF
 */
const generateEmissionsReport = async (data, options = {}) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    
    // Generate HTML content
    const html = generateReportHtml(data);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Add styles
    await page.addStyleTag({
      content: `
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #2C3E50; }
        .chart { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; }
        th { background-color: #f5f5f5; }
      `,
    });

    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
      printBackground: true,
    });

    // Upload to Cloudinary
    const result = await uploadFile(pdf.toString('base64'), {
      folder: 'reports',
      resource_type: 'raw',
      format: 'pdf',
      public_id: `emissions-report-${Date.now()}`,
    });

    logger.info(`Report generated and uploaded: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    logger.error('Report generation error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

/**
 * Generate HTML content for the report
 * @param {Object} data - Report data
 * @returns {string} HTML content
 */
const generateReportHtml = (data) => {
  const { user, emissions, period } = data;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Carbon Emissions Report</title>
      </head>
      <body>
        <h1>Carbon Emissions Report</h1>
        <p>Generated for: ${user.firstName} ${user.lastName}</p>
        <p>Period: ${format(period.start, 'PPP')} - ${format(period.end, 'PPP')}</p>
        
        <h2>Summary</h2>
        <table>
          <tr>
            <th>Total Emissions</th>
            <td>${emissions.total.toFixed(2)} kg CO2e</td>
          </tr>
          <tr>
            <th>Daily Average</th>
            <td>${emissions.dailyAverage.toFixed(2)} kg CO2e</td>
          </tr>
        </table>

        <h2>Emissions by Category</h2>
        <table>
          <tr>
            <th>Category</th>
            <th>Total (kg CO2e)</th>
            <th>Percentage</th>
          </tr>
          ${emissions.byCategory.map(cat => `
            <tr>
              <td>${cat.name}</td>
              <td>${cat.total.toFixed(2)}</td>
              <td>${cat.percentage.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </table>

        <h2>Monthly Trends</h2>
        <div class="chart">
          ${generateChartImage(emissions.trends)}
        </div>

        <h2>Recommendations</h2>
        <ul>
          ${generateRecommendations(emissions).map(rec => `
            <li>${rec}</li>
          `).join('')}
        </ul>
      </body>
    </html>
  `;
};

/**
 * Generate recommendations based on emissions data
 * @param {Object} emissions - Emissions data
 * @returns {Array<string>} List of recommendations
 */
const generateRecommendations = (emissions) => {
  const recommendations = [];
  const { byCategory } = emissions;

  // Transport recommendations
  const transport = byCategory.find(cat => cat.name === 'transport');
  if (transport && transport.percentage > 30) {
    recommendations.push('Consider using public transport or carpooling to reduce transport emissions.');
    recommendations.push('Look into electric or hybrid vehicle options for your next vehicle purchase.');
  }

  // Food recommendations
  const food = byCategory.find(cat => cat.name === 'food');
  if (food && food.percentage > 25) {
    recommendations.push('Try incorporating more plant-based meals into your diet.');
    recommendations.push('Buy local and seasonal produce to reduce food transport emissions.');
  }

  // Electricity recommendations
  const electricity = byCategory.find(cat => cat.name === 'electricity');
  if (electricity && electricity.percentage > 20) {
    recommendations.push('Switch to energy-efficient appliances and LED lighting.');
    recommendations.push('Consider installing solar panels or switching to a renewable energy provider.');
  }

  return recommendations;
};

/**
 * Generate a base64 chart image
 * @param {Array} data - Chart data
 * @returns {string} Base64 encoded chart image
 */
const generateChartImage = (data) => {
  // This is a placeholder. In a real implementation,
  // you would use a charting library like Chart.js to generate the chart
  return '<img src="chart_placeholder.png" alt="Emissions Trend Chart">';
};

module.exports = {
  generateEmissionsReport,
}; 