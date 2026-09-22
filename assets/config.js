var p206SavedConfig = {};
try { p206SavedConfig = JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem('p206_api_config_v1')) || '{}') || {}; } catch (e) {}
window.AB_CONFIG = {
  studyKey: 'p2-06-campus-mall-v1',
  apiBase: p206SavedConfig.apiBase || '',
  freeShippingThreshold: 53,
  shippingFee: 6,
  allowPreviewOverride: true
};
