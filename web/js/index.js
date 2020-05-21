import {
    PerspectiveCamera,
    Scene,
    Fog,
    AmbientLight,
    WebGLRenderer,
    DirectionalLight,
    PMREMGenerator,
    sRGBEncoding,
    Box3,
    Vector3
} from 'three';
import { WEBGL } from 'three/examples/jsm/WebGL.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';

/**
 * Initialize the THREE elements needed for rendering the GLTF data.
 * 
 * @returns {object} An object containing the `loadGltf` function.
 */
const initThreeJsElements = function() {
    const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1e6);
    camera.position.set(3, 3, 3);
        
    const scene = new Scene();
    scene.fog = new Fog(0xffffff, 0.1, 1e6);
    
    scene.add(new AmbientLight(0x777777));
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0.5, 0, 0.866);
    camera.add(directionalLight);
    
    const $viewport = document.getElementById('gltf-viewport');

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, (window.innerHeight - document.getElementById('elem-selector').offsetHeight) * 0.9, false);
    renderer.setClearColor(scene.fog.color, 1);
    renderer.shadowMap.enabled = true;
    
    scene.add(camera);
    renderer.physicallyCorrectLights = true;
    renderer.outputEncoding = sRGBEncoding;
    renderer.setPixelRatio(window.devicePixelRatio);
    const pmremGenerator = new PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    const controls = new TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 2.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.noZoom = false;
    controls.noPan = false;

    $viewport.appendChild(renderer.domElement);
    
    /**
     * Handles resizing the window.
     */
    const handleResize = () => {
        const width = window.innerWidth,
            height = (window.innerHeight - document.getElementById('elem-selector').offsetHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height * 0.9, false);
        render(renderer, scene, camera);
        controls.handleResize();
    };

    window.addEventListener('resize', handleResize, false);
    
    /**
     * Apply an operation to all mesh children of the given element.
     * 
     * @param {object} object The parent node whose children will be operated upon.
     * @param {Function<object,void>} callback The function to operate on the nodes.
     */
    const traverseMaterials = (object, callback) => {
        object.traverse((node) => {
            if (!node.isMesh) return;
            const materials = Array.isArray(node.material) ? node.material : [ node.material ];
            materials.forEach(callback);
        });
    };
    
    /**
     * Sets the contents of the scene to the given GLTF data.
     * 
     * @param {object} gltfScene The GLTF data to render.
     */
    const setGltfContents = (gltfScene) => {
        if (gltfScene) {
            // Remove existing GLTF scene from the scene
            const existingGltfScene = scene.getObjectByName('gltf_scene')
            if (existingGltfScene) scene.remove(existingGltfScene);
            
            const box = new Box3().setFromObject(gltfScene);
            const size = box.getSize(new Vector3()).length();
            const center = box.getCenter(new Vector3());
            
            controls.reset();
            
            gltfScene.position.x += (gltfScene.position.x - center.x);
            gltfScene.position.y += (gltfScene.position.y - center.y);
            gltfScene.position.z += (gltfScene.position.z - center.z);
            
            controls.maxDistance = size * 10;
            camera.near = size / 100;
            camera.far = size * 100;
            camera.updateProjectionMatrix();
            camera.position.copy(center);
            const boxSize = box.getSize();
            camera.position.x = boxSize.x * 2;
            camera.position.y = boxSize.y * 2;
            camera.position.z = boxSize.z * 2;
            camera.lookAt(center);
            
            gltfScene.name = 'gltf_scene';
            scene.add(gltfScene);
            
            controls.update();
            
            // Update textures
            traverseMaterials(gltfScene, (material) => {
                if (material.map) material.map.encoding = sRGBEncoding;
                if (material.emissiveMap) material.emissiveMap.encoding = sRGBEncoding;
                if (material.map || material.emissiveMap) material.needsUpdate = true;
            });
            
            // For some reason, without calling `handleResize` pan & rotate don't work...
            controls.handleResize();
        }
    };
    
    /**
     * Animate the scene.
     */
    const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        render(renderer, scene, camera);
    };
    
    /**
     * Render the scene.
     */
    const render = () => {
        renderer.render(scene, camera);
    };

    const gltfLoader = new GLTFLoader();
    
    // Without calling `handleResize`, the background is black initially.
    // (Changes to white when something is rendered.)
    handleResize();

    return {
        /**
         * Parse and load the given GLTF data, and trigger rendering.
         * 
         * @param {object} gltfData The GLTF data to be rendered.
         */
        loadGltf: (gltfData) => {
            gltfLoader.parse(gltfData, '',
                (gltf) => { // onLoad
                    document.body.style.cursor = 'default';
                    const gltfScene = gltf.scene || gltf.scenes[0];
                    setGltfContents(gltfScene);
                    animate();
                },
                (err) => { // onError
                    console.error('Error loading GLTF:', err);
                    displayError(`Error loading GLTF: ${err}`);
                });
        }
    };
};

/**
 * Execute a polling action until a particular outcome is achieved.
 * 
 * @param {number} intervalInSeconds The number of seconds between each poll request.
 * @param {Function<void,Promise>} promiseProducer The function which when called will perform the HTTP request and return a Promise.
 * @param {Function<Response,boolean>} stopCondFunc The function to be called on the result of `promiseProducer`; return true to stop polling.
 * @param {Function<string,void>} then The function to be called with the response body of the last polling request.
 */
const poll = (intervalInSeconds, promiseProducer, stopCondFunc, then) => {
    /**
     * Call `promiseProducer`, check if we should stop polling, and either call `then` with
     * the result, or call `setTimeout` to execute again in `intervalInSeconds` seconds.
     */
    const pollAndCheck = async () => {
        const res = await promiseProducer();
        if (stopCondFunc(res)) {
            const body = await res.text();
            then(body);
        } else {
            setTimeout(pollAndCheck, intervalInSeconds * 1000);
        }
    }
    // Start polling...
    pollAndCheck();
};

/**
 * Display an error message to the user.
 * 
 * @param {string} msg The error message to be displayed.
 */
const displayError = (msg) => {
    const $viewport = document.getElementById('gltf-viewport');
    const $msgElem = document.createElement('p');
    $msgElem.style.color = 'red';
    $msgElem.style.font = 'italic';
    $msgElem.innerText = msg;
    $viewport.insertBefore($msgElem, $viewport.firstChild);
}

if (!WEBGL.isWebGLAvailable()) {
    console.error('WebGL is not supported in this browser');
    document.getElementById('gltf-viewport').appendChild(WEBGL.getWebGLErrorMessage());
}

const { loadGltf } = initThreeJsElements();

const $elemSelector = document.getElementById('elem-selector');

$elemSelector.addEventListener('change', async (evt) => {
    // Trigger translation by getting /api/gltf
    const selectedOption = evt.target.options[event.target.selectedIndex];
    if (selectedOption.innerText !== '-- Select an Item --') {
        try {
            document.body.style.cursor = 'progress';
            const resp = await fetch(`/api/gltf${evt.target.options[event.target.selectedIndex].getAttribute('href')}`);
            const json = await resp.json();
            poll(5, () => fetch(`/api/gltf/${json.id}`), (resp) => resp.status !== 404, (respJson) => {
                if (respJson.error) {
                    console.error('Failed to obtain GLTF', err);
                    displayError('There was an error translating the model to GLTF.');
                } else {
                    console.log('Loading GLTF data...');
                    loadGltf(respJson);
                }
            });
        } catch (err) {
            console.error('Error requesting GLTF data translation', err);
                displayError(`Error requesting GLTF data translation: ${err}`);
        }
    }
});

// Get the Elements for the dropdown
fetch(`/api/elements${window.location.search}`, { headers: { 'Accept': 'application/json' } })
    .then((resp) => { return resp.json() })
    .then((json) => {
        for (const elem of json) {
            if (elem.elementType === 'PARTSTUDIO') {
                const child = document.createElement('option');
                child.setAttribute('href', `${window.location.search}&gltfElementId=${elem.id}`);
                child.innerText = `Element - ${elem.name}`;
                $elemSelector.appendChild(child);
                // Get the Parts of each element for the dropdown
                fetch(`/api/elements/${elem.id}/parts${window.location.search}`, { headers: { 'Accept': 'application/json' }})
                    .then((partsResp) => partsResp.json())
                    .then((partsJson) => {
                        console.log('[DEBUG] partsJson', partsJson);
                        for (const part of partsJson) {
                            const partChild = document.createElement('option');
                            partChild.setAttribute('href', `${window.location.search}&gltfElementId=${part.elementId}&partId=${part.partId}`);
                            partChild.innerText = `Part - ${elem.name} - ${part.name}`;
                            $elemSelector.appendChild(partChild);
                        }
                    }).catch((err) => {
                        console.error('Error while requesting element parts', err);
                        displayError(`Error while requesting element parts: ${err}`);
                    });
            }
        }
    }).catch((err) => {
        console.error('Error while requesting document elements', err);
        displayError(`Error while requesting document elements: ${err}`);
    });
