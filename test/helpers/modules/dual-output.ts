import {
  focusChild,
  click,
  clickCheckbox,
  clickButton,
  clickIfDisplayed,
  focusMain,
  isDisplayed,
} from './core';
import { showSettingsWindow } from './settings/settings';
import { getApiClient } from '../../helpers/api-client';
import { SceneBuilder } from '../../helpers/scene-builder';
import { SelectionService } from 'services/selection';
import { TExecutionContext } from '../webdriver';

/**
 * Toggle dual output mode
 */
export async function toggleDualOutputMode(closeChildWindow: boolean = true) {
  await showSettingsWindow('Video', async () => {
    await focusChild();
    await clickCheckbox('dual-output-checkbox');

    if (closeChildWindow) {
      await clickButton('Done');
    }
  });
}

/**
 * Toggle display
 */
export async function toggleDisplay(display: 'horizontal' | 'vertical', wait: boolean = false) {
  if (wait) {
    await clickIfDisplayed(`i#${display}-display-toggle`);
  } else {
    await click(`i#${display}-display-toggle`);
  }
}

/**
 * Create Dual Output scene
 *
 * @param reorder Whether or not to reorder nodes to create a corrupted Dual Output scene
 * @param extraNodes Whether or not to add nodes to create a corrupted Dual Output scene
 * @param missingNodes Whether of not to remove nodes to create a corrupted Dual Output scene
 * @param sceneSketch Optional, define a scene sketch instead of using the default
 */
export async function createDualOutputScene(
  t: TExecutionContext,
  reorder: boolean = false,
  extraNodes: boolean = false,
  missingNodes: boolean = false,
  sceneSketch?: string,
): Promise<string> {
  const client = await getApiClient();
  const sceneBuilder = new SceneBuilder(client);

  // Build a complex item and folder hierarchy
  const sketch =
    sceneSketch ??
    `
  Item1:
  Item2:
  Folder1
    Item3:
    Item4:
  Item5:
  Folder2
    Item6:
    Folder3
      Item7:
      Item8:
    Item9:
    Folder4
      Item10:
  Item11:
`;

  sceneBuilder.build(sketch);

  console.log('sceneBuilder.getSceneScketch() ', sceneBuilder.getSceneScketch());

  // toggle dual output on and convert dual output scene collection
  await toggleDualOutputMode();

  // wait for dual output to finish converting scene
  await focusMain();
  t.true(await isDisplayed('div#vertical-display'));

  console.log('done converting');

  console.log('sceneBuilder.getSceneScketch() ', sceneBuilder.getSceneScketch());

  if (reorder) {
    // add extra nodes
    if (extraNodes) {
    }

    // remove nodes
    if (missingNodes) {
    }
    // reorder the nodes (including the extra nodes)
    // const verticalFolder = sceneBuilder.scene.getNodeByNameAndDisplay('Folder2');
    // const verticalItem = sceneBuilder.scene.getNodeByNameAndDisplay('Item11', 'vertical');
    // const horizontalItem = sceneBuilder.scene.getNodeByNameAndDisplay('Item 3', 'horizontal');

    const scene = sceneBuilder.scene;
    const verticalFolder = scene.getNodeByNameAndDisplay('Folder2', 'vertical');
    const verticalItem = scene.getNodeByName('Item11');
    // const horizontalItem = sceneBuilder.scene.getNodeByName('Item 3');

    console.log('verticalFolder ', verticalFolder);
    console.log('verticalItem ', verticalItem);

    verticalFolder.placeAfter(verticalItem.id);
    // verticalItem.placeBefore(horizontalItem.id);

    console.log('new sketch ', sceneBuilder.getSceneScketch());

    return sceneBuilder.getSceneScketch();
  }

  // add extra nodes
  if (extraNodes) {
  }

  // remove nodes
  if (missingNodes) {
  }
  return sceneBuilder.getSceneScketch();
}
