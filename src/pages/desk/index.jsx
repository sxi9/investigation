import { createHost } from '../../dc.js';
import render from './App.jsx';
import Component from './logic.js';
import './pseudo.css';

export default createHost(Component, render);
