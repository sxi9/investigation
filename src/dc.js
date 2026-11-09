// Minimal stand-in for the design runtime's logic base class and helpers so
// the Investigation Board logic runs on stock React.
import React from 'react';

export class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; this.__host = null; }
  setState(update, cb) { this.__host && this.__host.__setLogicState(update, cb); }
  forceUpdate() { this.__host && this.__host.forceUpdate(); }
  componentDidMount() {}
  componentDidUpdate() {}
  componentWillUnmount() {}
  renderVals() { return {}; }
}

const kebabToCamel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export function cssToObj(css) {
  const o = {};
  for (const decl of String(css).split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    o[prop.startsWith('--') ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
  }
  return o;
}

/** Style attribute bound to a value: accepts a CSS string or a style object. */
export function sx(v) {
  if (typeof v === 'string') return cssToObj(v);
  return v && typeof v === 'object' ? v : undefined;
}

/**
 * Hosts a logic instance the way the design runtime does: state lives on the
 * logic object and is updated synchronously, then the host re-renders and
 * passes `{...props, ...renderVals()}` to the template.
 */
export function createHost(Logic, renderTemplate) {
  return class Host extends React.Component {
    constructor(props) {
      super(props);
      this.state = { __v: 0, __err: null };
      this.logic = new Logic(props);
      this.logic.__host = this;
      if (typeof window !== 'undefined' && !window.CIBPage) window.CIBPage = this.logic; // the page's logic, for overlays such as the research panel
    }
    static getDerivedStateFromError(e) { return { __err: e instanceof Error && e.message ? e.message : String(e) }; }
    componentDidCatch(e, info) { console.error('[board] render error:', e, info?.componentStack || ''); }
    __setLogicState(update, cb) {
      const prev = this.logic.state;
      const patch = typeof update === 'function' ? update(prev) : update;
      this.logic.state = { ...prev, ...patch };
      this.setState(s => ({ __v: s.__v + 1 }), cb);
    }
    componentDidMount() { this.logic.componentDidMount(); }
    componentDidUpdate(prevProps) { this.logic.props = this.props; this.logic.componentDidUpdate(prevProps); }
    componentWillUnmount() { this.logic.componentWillUnmount(); }
    render() {
      if (this.state.__err) {
        return React.createElement('div', { style: { position: 'fixed', top: 8, left: 8, zIndex: 2147483647, maxWidth: '60ch', padding: '6px 10px', background: '#b00020', color: '#fff', font: '12px/1.4 ui-monospace,monospace', borderRadius: 4, whiteSpace: 'pre-wrap' } }, this.state.__err);
      }
      this.logic.props = this.props;
      const vals = { ...this.props, ...(this.logic.renderVals() || {}) };
      return renderTemplate(vals);
    }
  };
}
