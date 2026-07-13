const fs = require('fs');
const xml2js = require('xml2js');

exports.parseALS = async (filePath) => {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const parser = new xml2js.Parser();

  try {
    const result = await parser.parseStringPromise(fileContent);
    const plugins = [];

    if (result && result.Ableton) {
      const devices = result.Ableton.LiveSet[0].Tracks[0].DeviceChain || [];
      devices.forEach((deviceChain) => {
        if (deviceChain.Device) {
          deviceChain.Device.forEach((device) => {
            plugins.push({
              name: device.$.Name || 'Unknown Device',
              type: 'Ableton Plugin',
            });
          });
        }
      });
    }

    return plugins;
  } catch (err) {
    console.error('Error parsing ALS file:', err);
    return [];
  }
};


