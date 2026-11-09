import { createHost } from '../../dc.js';
import render from './App.jsx';
import { DCLogic } from '../../dc.js';
const Component = DCLogic;
import './pseudo.css';

export default createHost(Component, render);
