const plugins = {};

const pluginList = [
  'CollapsibleTable',
  'SimpleConnectionsView',
  'HeatMapTable',
  'PartnerCompletenessView',
  'SimpleTable',
  'CellTypeView',
  'Graph',
];

pluginList.forEach(pluginName => {
  const plugin = require(`./${pluginName}`); // eslint-disable-line global-require, import/no-dynamic-require
  plugins[pluginName] = plugin.default;
});

const gl = document.createElement('canvas').getContext('webgl2');
if (gl) {
  const plugin = require('./NeuroglancerView'); // eslint-disable-line global-require
  plugins.NeuroglancerView = plugin.default;
}

export { plugins, pluginList };


export { default as HeatMapTable } from "./HeatMapTable";
export { default as SimpleTable } from "./SimpleTable";
