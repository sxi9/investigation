import { createHost } from '../../dc.js';
import render from './App.jsx';
import Component from './logic.js';
import './pseudo.css';
import './helmet.css';
export default createHost(Component, render);
