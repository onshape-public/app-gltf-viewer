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
    Vector3,
} from "three";
import { WEBGL } from "three/examples/jsm/WebGL.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";

const $openSelectBtn = document.getElementById("open-select-item-dialog");
/**
 * Initialize the THREE elements needed for rendering the GLTF data.
 *
 * @returns {object} An object containing the `loadGltf` function.
 */
const initThreeJsElements = function () {
    const camera = new PerspectiveCamera(
        35,
        window.innerWidth / window.innerHeight,
        0.1,
        1e6
    );
    camera.position.set(3, 3, 3);

    const scene = new Scene();
    scene.fog = new Fog(0xffffff, 0.1, 1e6);

    scene.add(new AmbientLight(0x777777));
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0.5, 0, 0.866);
    camera.add(directionalLight);

    const $viewport = document.getElementById("gltf-viewport");

    const renderer = new WebGLRenderer({ antialias: true });
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
     * This is how much we scale the height of the scene by to make it fit the window.
     */
    const heightScale = 0.9;

    /**
     * Handles resizing the window.
     */
    const handleResize = () => {
        const width = window.innerWidth,
            height = window.innerHeight * heightScale;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        render(renderer, scene, camera);
        controls.handleResize();
    };

    window.addEventListener("resize", handleResize, false);

    /**
     * Apply an operation to all mesh children of the given element.
     *
     * @param {object} object The parent node whose children will be operated upon.
     * @param {Function<object,void>} callback The function to operate on the nodes.
     */
    const traverseMaterials = (object, callback) => {
        object.traverse((node) => {
            if (!node.isMesh) return;
            const materials = Array.isArray(node.material)
                ? node.material
                : [node.material];
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
            const existingGltfScene = scene.getObjectByName("gltf_scene");
            if (existingGltfScene) scene.remove(existingGltfScene);

            const box = new Box3().setFromObject(gltfScene);
            const size = box.getSize(new Vector3()).length();
            const center = box.getCenter(new Vector3());

            controls.reset();

            gltfScene.position.x += gltfScene.position.x - center.x;
            gltfScene.position.y += gltfScene.position.y - center.y;
            gltfScene.position.z += gltfScene.position.z - center.z;

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

            gltfScene.name = "gltf_scene";
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
            gltfLoader.parse(
                gltfData,
                "",
                (gltf) => {
                    // onLoad
                    document.body.style.cursor = "default";
                    const gltfScene = gltf.scene || gltf.scenes[0];
                    setGltfContents(gltfScene);
                    animate();
                },
                (err) => {
                    // onError
                    displayError(`Error loading GLTF: ${err}`);
                }
            );
        },
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
    };
    // Start polling...
    pollAndCheck();
};

/**
 * Display an error message to the user.
 *
 * @param {string} msg The error message to be displayed.
 */
const displayError = (msg) => {
    console.log("Error:", msg);
    const $viewport = document.getElementById("gltf-viewport");
    const $msgElem = document.createElement("p");
    $msgElem.style.color = "red";
    $msgElem.style.font = "italic";
    $msgElem.innerText = msg;
    $viewport.insertBefore($msgElem, $viewport.firstChild);
};

if (!WEBGL.isWebGLAvailable()) {
    console.error("WebGL is not supported in this browser");
    document
        .getElementById("gltf-viewport")
        .appendChild(WEBGL.getWebGLErrorMessage());
}

const { loadGltf } = initThreeJsElements();
const messageNames = {
    OPEN_SELECT_DIALOG: "openSelectItemDialog",
    ITEM_SELECTED: "itemSelectedInSelectItemDialog",
    SELECT_DIALOG_CLOSED: "selectItemDialogClosed",
};

const loadGltfFromSelectedElement = async (href) => {
    // Trigger translation by getting /api/gltf
    try {
        document.body.style.cursor = "progress";
        console.log(`/api/gltf${href}`);
        const resp = await fetch(`/api/gltf${href}`);
        const json = await resp.json();
        poll(
            5,
            () => fetch(`/api/gltf/${json.id}`),
            (resp) => resp.status !== 202,
            (respJson) => {
                if (respJson.error) {
                    displayError("There was an error translating the model to GLTF.");
                } else {
                    console.log("Loading GLTF data...");
                    loadGltf(respJson);
                }
            }
        );
    } catch (err) {
        displayError(`Error requesting GLTF data translation: ${err}`);
    }
};

const formHrefFromReceivedData = (data) => {
    if (!data.documentId || !data.elementId || !data.workspaceId) {
        displayError(`Please select element with workspace`);
        return;
    }

    let documentId = data.documentId;
    let elementId = data.elementId;
    let workspaceId = data.workspaceId;

    let href = `?documentId=${documentId}&workspaceId=${workspaceId}&gltfElementId=${elementId}`;
    if (data.idTag && data.idTag.length > 0) {
        href += `&partId=${data.idTag}`;
    }
    return href;
};

const server = "https://cad.onshape.com";

var handlePostMessage = function (e) {
    if (server === e.origin) {
        if (e.data && e.data.messageName) {
            if (e.data.messageName === messageNames.ITEM_SELECTED) {
                let currElementHref = formHrefFromReceivedData(e.data);
                if (currElementHref) {
                    loadGltfFromSelectedElement(currElementHref);
                }
                $openSelectBtn.disabled = false;
            } else if (e.data.messageName === messageNames.SELECT_DIALOG_CLOSED) {
                $openSelectBtn.disabled = false;
            }
        }
    }
};

window.addEventListener("message", handlePostMessage, false);

const formOpenSelectDialogMessage = () => {
    var message = {
        messageName: messageNames.OPEN_SELECT_DIALOG,
        dialogTitle: "Select Item",
        selectBlobs: false,
        selectParts: true,
        selectPartStudios: true,
        selectAssemblies: false,
        selectMultiple: true,
        selectBlobMimeTypes: "",
        showBrowseDocuments: true,
        showStandardContent: false,
    };

    const currentPath = window.location.search;

    let params = new URLSearchParams(currentPath);
    if (
        !params.has("documentId") ||
        !params.has("workspaceId") ||
        !params.has("elementId")
    ) {
        displayError(`Error while requesting document elements: incorrect path`);
        return;
    }

    message.documentId = params.get("documentId");
    message.workspaceId = params.get("workspaceId");
    message.elementId = params.get("elementId");
    return message;
};

$openSelectBtn.onclick = () => {
    let message = formOpenSelectDialogMessage();
    if (message) {
        window.parent.postMessage(message, "*");
        $openSelectBtn.disabled = true;
    }
};
