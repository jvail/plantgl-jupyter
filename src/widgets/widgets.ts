import '../../css/widget.css';
import {
    DOMWidgetView, WidgetView
} from '@jupyter-widgets/base';
import * as THREE from 'three';
import geomDecoder from './bgeom-decoder';
// import dracoDecoder from './draco-decoder';
import { PGLControls, LsystemControls } from './controls';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
    IScene,
    IPGLControlsState,
    ILsystemControlsState,
    ILsystemScene
} from './interfaces';
import { disposeScene, isDracoFile } from './utilities';
import { SCALES, LsystemUnit } from './consts';
import { VBoxView } from '@jupyter-widgets/controls';

export class PGLWidgetView extends DOMWidgetView {

    camera: THREE.PerspectiveCamera = null;
    scene: THREE.Scene = null;
    renderer: THREE.WebGLRenderer = null;
    plane: THREE.Mesh = null;
    light: THREE.DirectionalLight = null;
    camLight: THREE.DirectionalLight = null;
    axesHelper: THREE.AxesHelper = null;
    lightHelper: THREE.DirectionalLightHelper = null;
    cameraHelper: THREE.CameraHelper = null;
    orbitControl = null;

    containerEl: HTMLDivElement = null;

    sizeDisplay: number[];
    sizeWorld: number[];

    pglControls: PGLControls = null;
    pglControlsState: IPGLControlsState = null;
    pglControlsEl: HTMLDivElement = null;

    disposables: THREE.Scene[] = [];
    isDetached = false;

    initialize(parameters: WidgetView.InitializeParameters) {
        super.initialize(parameters);
        this.sizeDisplay = parameters.model.attributes['size_display'];
        this.sizeWorld = parameters.model.attributes['size_world'];
    }

    render() {
        super.render();

        const initialState: IPGLControlsState = {
            axesHelper: this.model.get('axes_helper'),
            lightHelper: this.model.get('light_helper'),
            plane: this.model.get('plane'),
            fullscreen: false,
            autoRotate: false,
            showHeader: false,
            showControls: false
        };

        const [width, height] = this.sizeDisplay;
        this.pWidget.addClass('pgl-widget');
        this.containerEl = document.createElement('div');
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height
        const context = (canvas.getContext('webgl2', { alpha: false }) ||
            canvas.getContext('experimental-webgl', { alpha: false }) ||
            canvas.getContext('webgl', { alpha: false })) as WebGLRenderingContext;
        this.containerEl.appendChild(canvas);
        this.containerEl.setAttribute('class', 'pgl-jupyter-pgl-widget');
        this.el.appendChild(this.containerEl);

        this.pglControlsEl = document.createElement('div');
        this.pglControlsEl.setAttribute('class', 'pgl-jupyter-pgl-widget-controls');
        this.containerEl.appendChild(this.pglControlsEl);

        this.containerEl.addEventListener('contextmenu', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            return false;
        });

        const [x_size, y_size, z_size] = this.sizeWorld;

        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.01);
        this.camera.position.set(x_size / 2, y_size, z_size);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
        this.camera.up = new THREE.Vector3(0, 0, 1);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#9c9c9c');

        this.plane = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(x_size, y_size),
            new THREE.MeshPhongMaterial({
                color: new THREE.Color(0xFFFFFF)
            })
        );
        this.plane.name = 'plane';
        this.plane.receiveShadow = true;
        this.plane.visible = initialState.plane;
        this.scene.add(this.plane);

        this.axesHelper = new THREE.AxesHelper(Math.max.apply(Math, [x_size, y_size, z_size]) / 2)
        this.axesHelper.visible = initialState.axesHelper;
        this.scene.add(this.axesHelper);

        this.scene.add(new THREE.AmbientLight(0xFFFFFF, 0.4));

        const lightBottom = new THREE.DirectionalLight(0xFFFFFF, 1.1);
        lightBottom.position.set(0, -z_size, 0);
        this.scene.add(lightBottom);
        const lightTop = new THREE.DirectionalLight(0xFFFFFF, 1.1);
        lightTop.position.set(0, z_size, 0);
        this.scene.add(lightTop);

        this.light = new THREE.DirectionalLight(0xFFFFFF, 1.1);
        this.light.shadow.bias = -0.001;
        this.light.castShadow = true;
        this.light.position.set(x_size / 2, y_size / 2, Math.max(x_size, y_size) / 2);
        this.light.target.position.set(0, 0, 0);
        this.light.shadow.camera.up = new THREE.Vector3(0, 0, 1);
        this.light.shadow.camera.near = 0.01;
        this.light.shadow.camera.far = Math.sqrt(Math.pow(Math.sqrt(x_size * x_size + y_size * y_size), 2) + Math.pow(z_size, 2));
        this.light.shadow.camera.top = Math.sqrt(x_size * x_size + y_size * y_size) / 2;
        this.light.shadow.camera.bottom = -Math.sqrt(x_size * x_size + y_size * y_size) / 2;
        this.light.shadow.camera.left = -Math.sqrt(x_size * x_size + y_size * y_size) / 2;
        this.light.shadow.camera.right = Math.sqrt(x_size * x_size + y_size * y_size) / 2;
        this.scene.add(this.light);

        this.cameraHelper = new THREE.CameraHelper(this.light.shadow.camera);
        this.cameraHelper.visible = initialState.lightHelper;
        this.scene.add(this.cameraHelper);

        this.lightHelper = new THREE.DirectionalLightHelper(this.light);
        this.lightHelper.visible = initialState.lightHelper;
        this.scene.add(this.lightHelper);

        this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.render(this.scene, this.camera);

        this.orbitControl = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControl.enableZoom = true;
        this.orbitControl.addEventListener('change', () => {
            this.renderer.render(this.scene, this.camera)
        });
        this.renderer.render(this.scene, this.camera);
        this.orbitControl.target.set(0, 0, 0);
        this.orbitControl.update();

        this.pglControls = new PGLControls(initialState, {
            onFullscreenToggled: () => {
                if (document.fullscreenElement === this.containerEl) {
                    document.exitFullscreen();
                } else if (!document.fullscreenElement) {
                    this.containerEl.requestFullscreen();
                }
            },
            onAutoRotateToggled: (value: boolean) => {
                this.pglControlsState.autoRotate = value;
                if (this.orbitControl.autoRotate = this.pglControlsState.autoRotate) {
                    const rotate = () => {
                        const id = requestAnimationFrame(rotate);
                        if (!this.pglControlsState.autoRotate) {
                            window.cancelAnimationFrame(id)
                        }
                        this.orbitControl.update();
                        this.renderer.render(this.scene, this.camera);
                    };
                    rotate();
                }
            },
            onPlaneToggled: (value: boolean) => {
                this.pglControlsState.plane = value;
                this.plane.visible = this.pglControlsState.plane;
                this.renderer.render(this.scene, this.camera);
                this.model.set('plane', this.pglControlsState.plane);
                this.touch();
            },
            onAxesHelperToggled: (value: boolean) => {
                this.pglControlsState.axesHelper = value;
                this.axesHelper.visible = this.pglControlsState.axesHelper;
                this.renderer.render(this.scene, this.camera);
                this.model.set('axes_helper', this.pglControlsState.axesHelper);
                this.touch();
            },
            onLightHelperToggled: (value: boolean) => {
                this.pglControlsState.lightHelper = value;
                this.lightHelper.visible = this.pglControlsState.lightHelper;
                this.cameraHelper.visible = this.pglControlsState.lightHelper;
                this.renderer.render(this.scene, this.camera);
                this.model.set('light_helper', this.pglControlsState.lightHelper);
                this.touch();
            }
        }, this.pglControlsEl);
        this.pglControlsState = this.pglControls.state;

        this.containerEl.addEventListener('mouseover', () => this.pglControlsState.showHeader = true);
        this.containerEl.addEventListener('mouseout', () => this.pglControlsState.showHeader = false);

        this.listenTo(this.model, 'change:axes_helper', () => this.pglControls.evtHandlers.onAxesHelperToggled(
            this.model.get('axes_helper')
        ));
        this.listenTo(this.model, 'change:light_helper', () => this.pglControls.evtHandlers.onLightHelperToggled(
            this.model.get('light_helper')
        ));
        this.listenTo(this.model, 'change:plane', () => this.pglControls.evtHandlers.onPlaneToggled(
            this.model.get('plane')
        ));
        this.listenTo(this.model, 'change:size_display', () => {
            this.sizeDisplay = this.model.get('size_display') as number[];
            const [width, height] = this.sizeDisplay;
            this.resizeDisplay(width, height);
        });
        this.listenTo(this.model, 'change:size_world', this.resizeWorld);
        this.containerEl.onfullscreenchange = () => {
            this.pglControlsState.fullscreen = (document.fullscreenElement === this.containerEl);
            if (this.pglControlsState.fullscreen) {
                this.resizeDisplay(window.screen.width, window.screen.height);
            } else {
                const [width, height] = this.sizeDisplay;
                this.resizeDisplay(width, height);
            }
        }
    }

    resizeDisplay(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.renderer.render(this.scene, this.camera);
        this.orbitControl.update();
    }

    processPhosphorMessage(msg) {
        super.processPhosphorMessage(msg);
        switch (msg.type) {
            case 'resize':
                if (this.isDetached) {
                    const { width, height } = this.containerEl.getBoundingClientRect();
                    this.resizeDisplay(width, height - 5);
                }
                break;
            case 'after-attach':
                if (this.el.closest('.jp-LinkedOutputView')) {
                    this.pWidget.addClass('pgl-resizable');
                    this.containerEl.classList.add('pgl-resizable');
                    this.isDetached = true;
                    const output = this.containerEl.closest('.jp-OutputArea') as HTMLElement;
                    if (output) {
                        output.style.overflow = 'hidden';
                    }

                }
                break;
            default:
                break;
        }
    }

    resizeWorld() {
        const size = this.model.get('size_world');
    }

    remove() {
        // TODO: use a context pool for all widget instances in a notebook?
        this.renderer.dispose();
        super.remove();
    }

}

export class SceneWidgetView extends PGLWidgetView {

    initialize(parameters: WidgetView.InitializeParameters) {
        super.initialize(parameters);
    }

    render() {
        super.render();
        this.scene_changed();
        this.listenTo(this.model, 'change:scenes', this.scene_changed);
    }

    scene_changed() {
        this.addScenes(this.model.get('scenes') as IScene[]);
    }

    addScenes(scenes: IScene[]) {

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            if(!this.scene.getObjectByName(scene.id)) {
                const { id, data, position, scale } = scene;
                geomDecoder.decode({ data: data.buffer, userData: { position, scale, id } })
                    .then(result => {
                        const scene = new THREE.Scene();
                        const { results, userData: { position, scale, id } } = result;
                        const [x, y, z] = position;

                        if (results.length > 0) {
                            scene.add(...results);
                            scene.name = id;
                            scene.position.set(x, y, z);
                            scene.scale.multiplyScalar(scale);

                            this.scene.add(scene);
                            this.disposables.push(scene);
                            this.renderer.render(this.scene, this.camera);
                            this.orbitControl.update();
                        }
                    })
                    .catch(err => console.log(err));
            }
        }

    }

    remove() {
        // TODO: dispose helpers etc.?
        this.disposables.forEach(scene => disposeScene(scene));
        super.remove();
    }

}

export class LsystemWidgetView extends PGLWidgetView {

    unit: LsystemUnit = LsystemUnit.M;
    controls: LsystemControls = null;
    cache: {[key:number]: THREE.Mesh[]} = {};

    initialize(parameters: WidgetView.InitializeParameters) {
        super.initialize(parameters);
    }

    removeScenes() {
        this.scene.remove(...this.scene.children
            .filter(obj => obj instanceof THREE.Scene)
            .map(scene => {
                scene.visible = false;
                disposeScene(scene as THREE.Scene);
                return scene;
            }));
    }

    render() {
        super.render();

        const initialState: ILsystemControlsState = {
            animate: this.model.get('animate'),
            derivationStep: this.model.get('scene').derivationStep,
            derivationLength: this.model.get('derivationLength'),
            showControls: false,
            busy: 1,
            pyFeed: 0,
            comm_live: this.model.comm_live
        };

        const controlsEl = document.createElement('div');
        controlsEl.setAttribute('class', 'pgl-jupyter-lsystem-widget-controls');
        this.containerEl.appendChild(controlsEl);

        this.controls = new LsystemControls(initialState, {
            onAnimateToggled: (animate: boolean) => {
                this.controls.state.animate = animate;
                this.model.set('animate', animate);
                this.touch();
                if (animate) {
                    const pyFeedMax = Math.ceil(this.controls.state.derivationLength / 10);
                    const animation = (step) => {
                        // console.log('animation', step, this.controls.state.pyFeed);
                        if (this.controls.state.animate) {
                            this.controls.state.busy++;
                            this.controls.state.pyFeed++;
                            this.send({ derive: step });
                            if (step + 1 < this.controls.state.derivationLength) {
                                const next = (step) => {
                                    if (this.controls.state.pyFeed > pyFeedMax) {
                                        setTimeout(() => {
                                            next(step);
                                        }, 100);
                                    } else {
                                        animation(step)
                                    }
                                }
                                setTimeout(() => {
                                    next(step + 1);
                                }, 100);
                            }
                        }
                    }
                    const next = this.controls.state.derivationStep + 1;
                    animation(next >= this.controls.state.derivationLength ? 0 : next);
                }
            },
            onDeriveClicked: (step: number) => {
                this.controls.state.busy++;
                this.controls.state.pyFeed++;
                this.send({ derive: step });
            },
            onRewindClicked: () => {
                this.controls.state.busy = 1;
                this.controls.state.pyFeed = 0;
                this.controls.state.derivationStep = 0;
                this.send({ rewind: true });
                this.removeScenes();
                this.renderer.render(this.scene, this.camera);
                this.cache = [];
            }
        }, controlsEl);
        if (initialState.animate) {
            this.controls.evtHandlers.onAnimateToggled(true);
        }

        this.containerEl.addEventListener('mouseover', () => this.controls.state.showControls = true);
        this.containerEl.addEventListener('mouseout', () => this.controls.state.showControls = false);

        this.unit = this.model.get('unit');
        const scene = this.model.get('scene') as ILsystemScene;
        this.decode(scene);

        this.listenTo(this.model, 'change:unit', () => {
            this.unit = this.model.get('unit')
        });
        this.listenTo(this.model, 'change:derivationLength', () => {
            this.controls.state.derivationLength = this.model.get('derivationLength');
        });
        this.listenTo(this.model, 'comm_live_update', () => {
            this.controls.state.comm_live = this.model.comm_live;
        });
        this.listenTo(this.model, 'change:scene', () => {
            const scene = this.model.get('scene') as ILsystemScene;
            this.decode(scene);
            if (this.controls.state.pyFeed > 0) {
                this.controls.state.pyFeed--;
            }
        });
    }

    getFromCache() {
        setTimeout(() => {
            const step = this.controls.state.derivationStep + 1;
            const mesh = this.cache[step];
            // console.log('getFromCache', step, Object.keys(this.cache));
            if (mesh) {
                delete this.cache[step];
                this.setScene(step, mesh);
                this.controls.state.derivationStep = step;
                if (this.controls.state.busy > 0) {
                    this.controls.state.busy--;
                }
                if (this.controls.state.animate && this.controls.state.derivationStep === this.controls.state.derivationLength - 1) {
                    this.controls.state.animate = false;
                    this.model.set('animate', false);
                    this.touch();
                }
                if (this.cache[step + 1]) {
                    this.getFromCache();
                }
            }
        }, 500);
    }

    decode(scene: ILsystemScene) {
        if (isDracoFile(scene.data.buffer)) {
            // dracoDecoder.decode({ data: scene.data.buffer, userData: { step: scene.derivationStep } })
            //     .then(res => {
            //         const { results, userData: { step } } = res;
            //         if (this.controls.state.animate && step - this.controls.state.derivationStep > 1) {
            //             this.cache[step] = results;
            //         } else {
            //             this.addScene(step, results);
            //             this.controls.state.derivationStep = step;
            //             this.controls.state.busy--;
            //             if (this.cache[step + 1]) {
            //                 this.getFromCache();
            //             }
            //         }
            //     })
            //     .catch(err => console.log(err));
        } else {
            geomDecoder.decode({ data: scene.data.buffer, userData: { step: scene.derivationStep } })
                .then(res => {
                    const { results, userData: { step } } = res;
                    if (this.controls.state.animate && step - this.controls.state.derivationStep > 1) {
                        this.cache[step] = results;
                    } else {
                        this.setScene(step, results);
                        this.controls.state.derivationStep = step;
                        if (this.controls.state.busy > 0) {
                            this.controls.state.busy--;
                        }
                        if (this.controls.state.animate && this.controls.state.derivationStep === this.controls.state.derivationLength - 1) {
                            this.controls.state.animate = false;
                            this.model.set('animate', false);
                            this.touch();
                        }
                        if (this.cache[step + 1]) {
                            this.getFromCache();
                        }
                    }
                    // console.log('decoded', step);
                })
                .catch(err => console.log(err));
        }
    }

    setScene(step: number, meshs, position = [0, 0, 0]) {

        const currentScene = new THREE.Scene();
        const [x, y, z] = position;
        const scale = SCALES[this.unit];
        currentScene.scale.multiplyScalar(scale);
        currentScene.position.set(x, y, z);
        currentScene.add(...meshs);
        currentScene.userData = { step };
        currentScene.name = 'lsystem';

        const previousScene = this.scene.getObjectByName('lsystem') as THREE.Scene;
        if (previousScene) {
            previousScene.visible = false;
        }

        this.scene.add(currentScene);
        this.renderer.render(this.scene, this.camera);
        this.orbitControl.update();

        if (previousScene) {
            this.scene.remove(previousScene);
            disposeScene(previousScene);
        }

    }

    remove() {
        super.remove();
    }

}


export class ParameterEditorView extends VBoxView {
    initialize(parameters) {
        super.initialize(parameters);
        this.pWidget.addClass('pgl-parameter-editor');
      }
}
