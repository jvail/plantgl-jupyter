import { render, html } from 'lit-html';
import { styleMap } from 'lit-html/directives/style-map'
import '@material/mwc-checkbox';
import '@material/mwc-formfield';
import '@material/mwc-icon-button-toggle';
import '@material/mwc-icon-button';
import '@material/mwc-linear-progress';
import {
    IPGLControlState,
    IPGLControlHandlers,
    ILsystemControlState,
    ILsystemControlHandlers
} from './types';

// TODO refactor handlers

export class PGLControls {

    evtHandlers: IPGLControlHandlers;
    state: IPGLControlState;
    controlsEl: HTMLElement;

    constructor(state: IPGLControlState, evtHandlers: IPGLControlHandlers, controlsEl: HTMLElement) {
        this.controlsEl = controlsEl;
        this.evtHandlers = evtHandlers;
        const that = this;
        this.state = new Proxy(state, {
            set(obj, prop, value) {
                if (value !== obj[prop]) {
                    const res =  Reflect.set(obj, prop, value);
                    if (res) that.render();
                    return res;
                }
                return true;
            }
        });
    };

    private render() {
        render(this.renderControls(this.state, this.evtHandlers), this.controlsEl);
    };

    private renderControls = (state: IPGLControlState, handlers: IPGLControlHandlers) => {
        return html`<div class='pgl-jupyter-scene-widget-controls-container' style=${styleMap(state.showControls ? { 'background-color': '#00305312' } : {})}>
            <div class='pgl-jupyter-scene-widget-controls-header' style=${styleMap(state.showControls || state.showHeader ? { 'display': 'block' } : { 'display': 'none' })}>
                <mwc-icon-button icon="&#9881;" @click=${() => state.showControls = !state.showControls}></mwc-icon-button>
            </div>
            <div class='pgl-jupyter-scene-widget-controls-body unselectable' style=${styleMap(state.showControls ? { 'display': 'block' } : { 'display': 'none' })}'>
                <mwc-formfield label='fullscreen'>
                    <mwc-checkbox @change=${(evt) => handlers.onFullscreenToggled(evt.target.checked)} ?checked=${state.fullscreen}></mwc-checkbox>
                </mwc-formfield>
                <mwc-formfield label='auto rotate'>
                    <mwc-checkbox @change=${(evt) => handlers.onAutoRotateToggled(evt.target.checked)} ?checked=${state.autoRotate}></mwc-checkbox>
                </mwc-formfield>
                <mwc-formfield label='plane'>
                    <mwc-checkbox @change=${(evt) => handlers.onPlaneToggled(evt.target.checked)} ?checked=${state.plane}></mwc-checkbox>
                </mwc-formfield>
                <mwc-formfield label='axes helper'>
                    <mwc-checkbox @change=${(evt) => handlers.onAxesHelperToggled(evt.target.checked)} ?checked=${state.axesHelper}></mwc-checkbox>
                </mwc-formfield>
                <mwc-formfield label='light helper'>
                    <mwc-checkbox @change=${(evt) => handlers.onLightHelperToggled(evt.target.checked)} ?checked=${state.lightHelper}></mwc-checkbox>
                </mwc-formfield>
            </div>
        </div>`;
    };
}

export class LsystemControls {

    state: ILsystemControlState;
    evtHandlers: ILsystemControlHandlers;
    controlsEl: HTMLElement;

    constructor(state: ILsystemControlState, evtHandlers: ILsystemControlHandlers, controlsEl: HTMLElement) {
        this.controlsEl = controlsEl;
        this.evtHandlers = evtHandlers;
        const that = this;
        this.state = new Proxy(state, {
            set(obj, prop, value) {
                if (value !== obj[prop]) {
                    const res = Reflect.set(obj, prop, value);
                    if (res) that.render();
                    return res;
                }
                return true;
            }
        });
    };

    private render() {
        render(this.renderControls(this.state, this.evtHandlers), this.controlsEl);
    };

    private renderControls = (state: ILsystemControlState, handlers: ILsystemControlHandlers) => {
        return html`<div class='pgl-jupyter-lsystem-widget-controls-container unselectable'>
            <div style=${styleMap(state.showControls ? { 'display': 'block' } : { 'visibility': 'hidden' })}>
                <mwc-icon-button icon="&#8676"
                    ?disabled=${state.animate || state.derivationStep === 0 || state.busy}
                    @click=${(evt) => evt.target.disabled || handlers.onDeriveClicked(0)}>
                </mwc-icon-button>
                <mwc-icon-button icon="&#8612"
                    ?disabled=${state.animate || state.derivationStep === 0 || state.busy}
                    @click=${(evt) => evt.target.disabled || handlers.onDeriveClicked(state.derivationStep - 1)}>
                </mwc-icon-button>
                <mwc-icon-button icon="&#8614"
                    ?disabled=${state.animate || state.derivationStep === state.derivationLength - 1 || state.busy}
                    @click=${(evt) => evt.target.disabled || handlers.onDeriveClicked(state.derivationStep + 1)}>
                </mwc-icon-button>
                <mwc-icon-button icon="&#8677"
                    ?disabled=${state.animate || state.derivationStep === state.derivationLength - 1 || state.busy}
                    @click=${(evt) => evt.target.disabled || handlers.onDeriveClicked(state.derivationLength - 1)}>
                </mwc-icon-button>
                <mwc-icon-button-toggle
                    ?disabled=${!state.animate && state.busy}
                    ?on=${state.animate}
                    ?off=${!state.animate}
                    onIcon="&#8603"
                    offIcon="&#8620"
                    @click=${(evt) => evt.target.disabled || handlers.onAnimateToggled(!state.animate)}>
                </mwc-icon-button-toggle>
                <mwc-icon-button icon="&#8634"
                    ?disabled=${state.animate || state.busy}
                    @click=${(evt) => evt.target.disabled || handlers.onRewindClicked()}>
                </mwc-icon-button>
            </div>
            <div style=${styleMap((state.derivationStep < state.derivationLength - 1 && (state.showControls || state.animate || state.busy)) ? { 'display': 'block' } : { 'visibility': 'hidden' })}>
                <mwc-linear-progress
                    progress=${state.derivationStep / (state.derivationLength - 1)}
                    buffer=${state.busy ? state.derivationStep / (state.derivationLength - 1) : 1}>
                </mwc-linear-progress>
            </div>
        </div>`;
    };
}
