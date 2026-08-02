const mqtt = require('mqtt');

const brokerUrl = 'mqtt://broker.hivemq.com'; 
const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log('>>> [MQTT] Đã kết nối thành công tới MQTT Broker!');
  
  // ĐĂNG KÝ LẮNG NGHE NGAY BÊN TRONG HÀM NÀY
  client.subscribe('myCTU/locker/sensor', (err) => {
    if (!err) console.log('>>> [MQTT] Đang lắng nghe kênh Cảm biến từ ESP32!');
  });
});

client.on('error', (err) => {
  console.error('>>> [MQTT] Lỗi kết nối:', err);
});

module.exports = client;