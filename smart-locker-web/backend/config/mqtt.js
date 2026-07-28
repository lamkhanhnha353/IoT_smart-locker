
const mqtt = require('mqtt');

// Kết nối đến một MQTT Broker miễn phí (bạn có thể đổi sang server khác nếu muốn)
const brokerUrl = 'mqtt://broker.hivemq.com'; 
const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log('>>> [MQTT] Đã kết nối thành công tới MQTT Broker!');
  // Đăng ký nghe một topic mặc định
  client.subscribe('myCTU/locker/status', (err) => {
    if (!err) console.log('>>> [MQTT] Đang lắng nghe trạng thái tủ...');
  });
});

client.on('error', (err) => {
  console.error('>>> [MQTT] Lỗi kết nối:', err);
});

module.exports = client;