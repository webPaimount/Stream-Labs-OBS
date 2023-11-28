import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip, Tree } from 'antd';
import { DataNode } from 'rc-tree/lib/interface';
import { TreeProps } from 'rc-tree/lib/Tree';
import cx from 'classnames';
import { TSceneNode, isItem } from 'services/scenes';
import { EditMenu } from 'util/menus/EditMenu';
import { $t } from 'services/i18n';
import { EPlaceType } from 'services/editor-commands/commands/reorder-nodes';
import { EDismissable } from 'services/dismissables';
import { assertIsDefined, getDefined } from 'util/properties-type-guards';
import useBaseElement from './hooks';
import styles from './SceneSelector.m.less';
import Scrollable from 'components-react/shared/Scrollable';
import HelpTip from 'components-react/shared/HelpTip';
import Translate from 'components-react/shared/Translate';
import { DualOutputSourceSelector } from './DualOutputSourceSelector';
import { Services } from 'components-react/service-provider';
import { initStore, useController } from '../../hooks/zustand';
import { useVuex } from '../../hooks';

interface ISourceMetadata {
  id: string;
  title: string;
  icon: string;
  isVisible: boolean;
  isLocked: boolean;
  isStreamVisible: boolean;
  isRecordingVisible: boolean;
  isGuestCamActive: boolean;
  isDualOutputActive: boolean;
  isFolder: boolean;
  canShowActions: boolean;
  parentId?: string;
  sceneId?: string;
  toggleAll?: boolean;
}

class SourceSelectorController {
  private scenesService = Services.ScenesService;
  private sourcesService = Services.SourcesService;
  private widgetsService = Services.WidgetsService;
  private selectionService = Services.SelectionService;
  private editorCommandsService = Services.EditorCommandsService;
  private streamingService = Services.StreamingService;
  private audioService = Services.AudioService;
  private guestCamService = Services.GuestCamService;
  private dualOutputService = Services.DualOutputService;

  sourcesTooltip = $t('The building blocks of your scene. Also contains widgets.');
  addSourceTooltip = $t('Add a new Source to your Scene. Includes widgets.');
  openSourcePropertiesTooltip = $t('Open the Source Properties.');
  addGroupTooltip = $t('Add a Group so you can move multiple Sources at the same time.');

  store = initStore({
    expandedFoldersIds: [] as string[],
    showTreeMask: true,
  });

  nodeRefs = {};

  /**
   * This property handles selection when expanding/collapsing folders
   */
  callCameFromInsideTheHouse = false;
  /**
   * This property handles selection when clicking a dual output icon
   */
  callCameFromIcon = false;

  constructor() {
    this.selectionService.store.watch(
      s => s.lastSelectedId,
      () => this.expandSelectedFolders(),
    );
  }

  getTreeData(nodeData: ISourceMetadata[]) {
    // recursive function for transforming SceneNode[] to a Tree format of Antd.Tree
    const getTreeNodes = (sceneNodes: ISourceMetadata[]): DataNode[] => {
      return sceneNodes.map(sceneNode => {
        if (!this.nodeRefs[sceneNode.id]) this.nodeRefs[sceneNode.id] = React.createRef();

        let children;
        if (sceneNode.isFolder) {
          children = getTreeNodes(nodeData.filter(n => n.parentId === sceneNode.id));
        }

        return {
          title: (
            <TreeNode
              title={sceneNode.title}
              id={sceneNode.id}
              sceneId={sceneNode.sceneId}
              isVisible={sceneNode.isVisible}
              isLocked={sceneNode.isLocked}
              canShowActions={sceneNode.canShowActions}
              toggleVisibility={() => this.toggleVisibility(sceneNode.id, sceneNode?.toggleAll)}
              toggleLock={() => this.toggleLock(sceneNode.id)}
              selectiveRecordingEnabled={this.selectiveRecordingEnabled}
              isStreamVisible={sceneNode.isStreamVisible}
              isRecordingVisible={sceneNode.isRecordingVisible}
              isGuestCamActive={sceneNode.isGuestCamActive}
              isDualOutputActive={sceneNode.isDualOutputActive}
              hasNodeMap={this.hasNodeMap}
              cycleSelectiveRecording={() => this.cycleSelectiveRecording(sceneNode.id)}
              ref={this.nodeRefs[sceneNode.id]}
              onDoubleClick={() => this.sourceProperties(sceneNode.id)}
              removeSource={() => this.removeItems(sceneNode.id)}
              sourceProperties={() => this.sourceProperties(sceneNode.id)}
            />
          ),
          isLeaf: !children,
          key: sceneNode.id,
          switcherIcon: <i className={sceneNode.icon} />,
          children,
        };
      });
    };

    return getTreeNodes(nodeData.filter(n => !n.parentId));
  }

  get nodeData(): ISourceMetadata[] {
    return this.scene.getSourceSelectorNodes().map(node => {
      const itemsForNode = this.scene.getItemsForNode(node.id);
      const toggleAll = !!this.dualOutputService.views.sceneNodeMaps[this.scene.id];

      const isLocked = itemsForNode.every(i => i.locked);
      const isRecordingVisible = itemsForNode.every(i => i.recordingVisible);
      const isStreamVisible = itemsForNode.every(i => i.streamVisible);
      const isGuestCamActive = itemsForNode.some(i => {
        return (
          this.sourcesService.state.sources[i.sourceId].type === 'mediasoupconnector' &&
          !!this.guestCamService.views.getGuestBySourceId(i.sourceId)
        );
      });
      const isDualOutputActive = this.isDualOutputActive;
      const isFolder = !isItem(node);

      let isVisible = itemsForNode.some(i => i.visible);

      // In dual output mode, the icon-view/icon-hide toggle only updates when
      // all scene items have the same visibility
      if (toggleAll && this.isDualOutputActive) {
        const dualOutputNodeId = this.dualOutputService.views.getDualOutputNodeId(node.id);
        const itemsForDualOutputNode = this.scene.getItemsForNode(dualOutputNodeId);
        isVisible =
          itemsForNode.some(i => i.visible) || itemsForDualOutputNode.some(i => i.visible);
      }

      // create the object
      return {
        id: node.id,
        title: this.getNameForNode(node),
        icon: this.determineIcon(!isFolder, isFolder ? node.id : node.sourceId),
        isVisible,
        isLocked,
        isRecordingVisible,
        isStreamVisible,
        isGuestCamActive,
        isDualOutputActive,
        parentId: node.parentId,
        sceneId: node.sceneId,
        canShowActions: itemsForNode.length > 0,
        isFolder,
        toggleAll,
      };
    });
  }

  // TODO: Clean this up.  These only access state, no helpers
  getNameForNode(node: TSceneNode) {
    if (isItem(node)) {
      return this.sourcesService.state.sources[node.sourceId].name;
    }

    return node.name;
  }

  isSelected(node: TSceneNode) {
    return this.selectionService.state.selectedIds.includes(node.id);
  }

  determineIcon(isLeaf: boolean, sourceId: string) {
    if (!isLeaf) {
      return this.store.expandedFoldersIds.includes(sourceId)
        ? 'fas fa-folder-open'
        : 'fa fa-folder';
    }

    const { sourcesService, widgetsService } = this;
    const source = sourcesService.state.sources[sourceId];

    if (source.propertiesManagerType === 'streamlabels') {
      return 'fas fa-file-alt';
    }

    if (source.propertiesManagerType === 'widget') {
      const widgetType = this.sourcesService.views
        .getSource(sourceId)!
        .getPropertiesManagerSettings().widgetType;

      assertIsDefined(widgetType);

      return widgetsService.widgetDisplayData[widgetType]?.icon || 'icon-error';
    }

    return sourcesService.sourceDisplayData[source.type]?.icon || 'fas fa-file';
  }

  addSource() {
    if (this.scenesService.views.activeScene) {
      this.sourcesService.showShowcase();
    }
  }

  addFolder() {
    if (this.scenesService.views.activeScene) {
      let itemsToGroup: string[] = [];
      let parentId: string = '';
      if (this.selectionService.views.globalSelection.canGroupIntoFolder()) {
        itemsToGroup = this.selectionService.views.globalSelection.getIds();
        const parent = this.selectionService.views.globalSelection.getClosestParent();
        if (parent) parentId = parent.id;
      }
      this.scenesService.showNameFolder({
        itemsToGroup,
        parentId,
        sceneId: this.scenesService.views.activeScene.id,
      });
    }
  }

  showContextMenu(sceneNodeId?: string, event?: React.MouseEvent) {
    const sceneNode = this.scene.getNode(sceneNodeId || '');
    let sourceId: string = '';

    if (sceneNode) {
      sourceId = sceneNode.isFolder() ? sceneNode.getItems()[0]?.sourceId : sceneNode.sourceId;
    }

    if (sceneNode && !sceneNode.isSelected()) sceneNode.select(true);
    const menuOptions = sceneNode
      ? { selectedSceneId: this.scene.id, showSceneItemMenu: true, selectedSourceId: sourceId }
      : { selectedSceneId: this.scene.id };

    const menu = new EditMenu(menuOptions);
    menu.popup();
    event && event.stopPropagation();
  }

  async removeItems(id?: string) {
    if (id) {
      await this.selectionService.actions.return.select([id]);
    }
    this.selectionService.views.globalSelection.remove();
  }

  sourceProperties(nodeId: string) {
    const node =
      this.scenesService.views.getSceneNode(nodeId) ||
      this.selectionService.views.globalSelection.getNodes()[0];

    if (!node) return;

    const item = node.isItem() ? node : node.getNestedItems()[0];

    if (!item) return;

    if (item.type === 'scene') {
      this.scenesService.actions.makeSceneActive(item.sourceId);
      return;
    }

    if (!item.video) {
      this.audioService.actions.showAdvancedSettings(item.sourceId);
      return;
    }

    this.sourcesService.actions.showSourceProperties(item.sourceId);
  }

  determinePlacement(info: Parameters<Required<TreeProps>['onDrop']>[0]) {
    if (!info.dropToGap && !info.node.isLeaf) return EPlaceType.Inside;
    const dropPos = info.node.pos.split('-');
    const delta = info.dropPosition - Number(dropPos[dropPos.length - 1]);

    return delta > 0 ? EPlaceType.After : EPlaceType.Before;
  }

  async handleSort(info: Parameters<Required<TreeProps>['onDrop']>[0]) {
    const targetNodes =
      this.activeItemIds.length > 0 && this.activeItemIds.includes(info.dragNode.key as string)
        ? this.activeItemIds
        : (info.dragNodesKeys as string[]);
    const nodesToDrop = this.scene.getSelection(targetNodes);
    const destNode = this.scene.getNode(info.node.key as string);
    const placement = this.determinePlacement(info);

    if (!nodesToDrop || !destNode) return;
    if (targetNodes.some(nodeId => nodeId === destNode.id)) return;

    await this.editorCommandsService.actions.return.executeCommand(
      'ReorderNodesCommand',
      nodesToDrop,
      destNode?.id,
      placement,
    );

    /**
     * If this is a dual output scene, reorder the corresponding nodes
     */
    if (this.dualOutputService.views.hasSceneNodeMaps) {
      const destNodeId = destNode?.id ?? (info.node.key as string);
      const dualOutputNodes = targetNodes
        .map(nodeId => {
          const dualOutputNodeId = this.dualOutputService.views.getDualOutputNodeId(nodeId);
          if (dualOutputNodeId) {
            return dualOutputNodeId;
          }
        })
        .filter(nodeId => typeof nodeId === 'string') as string[];
      const dualOutputNodesToDrop = this.scene.getSelection(dualOutputNodes);
      const dualOutputDestNodeId = this.dualOutputService.views.getDualOutputNodeId(destNodeId);
      if (!dualOutputDestNodeId) return;
      const dualOutputNode = this.scene.getNode(dualOutputDestNodeId);

      if (!dualOutputNodesToDrop || !dualOutputNode) return;
      if (dualOutputNodes.some(nodeId => nodeId === dualOutputNode.id)) return;

      await this.editorCommandsService.actions.return.executeCommand(
        'ReorderNodesCommand',
        dualOutputNodesToDrop,
        dualOutputNode?.id,
        placement,
      );
    }
  }

  makeActive(info: { node: DataNode; nativeEvent: MouseEvent } | string) {
    this.callCameFromInsideTheHouse = true;

    /**
     * For calls made from a dual output toggle,
     * select only the source from the icon clicked
     */
    if (typeof info === 'string') {
      this.callCameFromIcon = true;
      this.selectionService.views.globalSelection.reset();
      this.selectionService.views.globalSelection.select([info]);
      return;
    }

    /**
     * Skip multiselect logic when call is made from toggle
     */
    if (!this.callCameFromIcon) {
      let ids: string[] = [info.node.key as string];

      if (info.nativeEvent.ctrlKey) {
        ids = this.activeItemIds.concat(ids);
      } else if (info.nativeEvent.shiftKey) {
        // Logic for multi-select
        const idx1 = this.nodeData.findIndex(
          i => i.id === this.activeItemIds[this.activeItemIds.length - 1],
        );
        const idx2 = this.nodeData.findIndex(i => i.id === info.node.key);
        const swapIdx = idx1 > idx2;
        ids = this.nodeData
          .map(i => i.id)
          .slice(swapIdx ? idx2 : idx1, swapIdx ? idx1 + 1 : idx2 + 1);
      }

      /**
       * In dual output mode with both displays active,
       * clicking on the source selector selects both sources
       */
      if (
        this.dualOutputService.views.hasNodeMap(this.scene.id) &&
        this.dualOutputService.views.activeDisplays.horizontal &&
        this.dualOutputService.views.activeDisplays.vertical
      ) {
        const updatedIds = new Set(ids);
        ids.forEach(id => {
          const dualOutputNodeId = this.dualOutputService.views.getDualOutputNodeId(id);
          if (dualOutputNodeId && !updatedIds.has(dualOutputNodeId)) {
            updatedIds.add(dualOutputNodeId);
          }
        });

        ids = Array.from(updatedIds);
      }
      this.selectionService.views.globalSelection.select(ids);
    }

    this.callCameFromIcon = false;
  }

  toggleFolder(nodeId: string) {
    this.store.setState(s => {
      if (s.expandedFoldersIds.includes(nodeId)) {
        s.expandedFoldersIds.splice(s.expandedFoldersIds.indexOf(nodeId), 1);
      } else {
        s.expandedFoldersIds.push(nodeId);
      }
    });
  }

  get lastSelectedId() {
    return this.selectionService.state.lastSelectedId;
  }

  get isDualOutputActive() {
    return this.dualOutputService.views.dualOutputMode;
  }

  /**
   * Determines if the current scene has a node map entry in the scene collections node map.
   * The existence of the scene node maps property in the scene collection's manifest indicates
   * that the scene collection has been converted to a dual output scene. An entry in the
   * scene node maps in the scene collection manifest indicates that the scene in the
   * scene collection has been made active in dual output mode. To reduce bulk, scenes only
   * create vertical nodes when the following are true:
   *   1. The scene collection has been opened in dual output mode.
   *   2. The scene has been opened at any point after the scene collection has been opened in
   *      dual output mode.
   * This is a finite distinction from the scene collection having any node maps for any scene.
   */
  get hasNodeMap() {
    return !!this.dualOutputService.views.sceneNodeMaps[this.scene.id];
  }
  /**
   * True if there are any node maps in the scene collections scene node map property
   * in the scene collections manifest or if dual output mode is on.
   */
  get hasSceneNodeMaps() {
    return this.dualOutputService.views.hasSceneNodeMaps;
  }

  get horizontalActive() {
    return this.dualOutputService.views.activeDisplays.horizontal;
  }

  get verticalActive() {
    return this.dualOutputService.views.activeDisplays.vertical;
  }

  async expandSelectedFolders() {
    if (this.callCameFromInsideTheHouse) {
      this.callCameFromInsideTheHouse = false;
      return;
    }
    const node = this.scene.getNode(this.lastSelectedId);
    if (!node || this.selectionService.state.selectedIds.length > 1) return;

    this.store.setState(s => {
      s.expandedFoldersIds.concat(node.getPath().slice(0, -1));
    });

    this.nodeRefs[this.lastSelectedId]?.current?.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Used for actions initiated from the source selector such as sorting and selecting
   */
  get activeItemIds() {
    /* Because the source selector only works with either the horizontal
     * or vertical node ids at one time, filter them in a dual output scene.
     */
    if (this.dualOutputService.views.hasNodeMap()) {
      const selectedIds = this.selectionService.state.selectedIds;
      const nodeIds = this.dualOutputService.views.onlyVerticalDisplayActive
        ? this.dualOutputService.views.verticalNodeIds
        : this.dualOutputService.views.horizontalNodeIds;

      if (!nodeIds) return selectedIds;

      return selectedIds.filter(id => nodeIds.includes(id));
    }

    return this.selectionService.state.selectedIds;
  }

  /**
   * Used to highlight selected items in the source selector
   */
  get selectionItemIds() {
    /**
     * When both displays are active, the source selector rows use the horizontal nodes to render.
     * To highlight the source in the source selector when interacting with the source
     * in the vertical display, convert the vertical node id to the horizontal node id.
     */
    if (
      this.dualOutputService.views.activeDisplays.horizontal &&
      this.dualOutputService.views.activeDisplays.vertical
    ) {
      const selectedIds = new Set(this.selectionService.state.selectedIds);

      this.selectionService.state.selectedIds.map(id => {
        const horizontalNodeId = this.dualOutputService.views.getHorizontalNodeId(id);
        if (horizontalNodeId && !selectedIds.has(horizontalNodeId)) {
          selectedIds.add(horizontalNodeId);
        }
      });

      return Array.from(selectedIds);
    }
    // In all other cases, return all selected ids
    return this.selectionService.state.selectedIds;
  }

  /**
   * Used to get all items in the selection
   */
  get activeItems() {
    return this.selectionService.views.globalSelection.getItems();
  }

  /**
   * Toggle the visibility of the scene item
   * @remark If the intent is to toggle scene items in both displays but the partner
   * node id for dual output cannot be found, this will just toggle the selected node
   * @param sceneNodeId - string of the id of the node selected
   * @param toggleAll - boolean for whether nodes in both displays should be toggled
   */
  toggleVisibility(sceneNodeId: string | undefined, toggleAll: boolean = false) {
    if (!sceneNodeId) return;

    if (toggleAll) {
      const bothToggled = this.toggleBothVisibility(sceneNodeId);
      if (bothToggled) return;
    }

    const selection = this.scene.getSelection(sceneNodeId);
    const visible = !selection.isVisible();
    this.editorCommandsService.actions.executeCommand('HideItemsCommand', selection, !visible);
  }

  /**
   * Primarily used to toggle both dual output scene items at the same time
   * @remark A little counterintuitive, but to reduce executions of the hide items command,
   * this function only executes the hide items command if both scene items currently have
   * the same visibility. This instead of setting the dual output node to the same visibility
   * as the selected node and then applying the desired visibility to both.
   *
   * Otherwise, proceed with toggling just the selected node because this will match
   * the visibility between the two nodes.
   *
   * If the partner node id is not found, only the selected node is toggled.

   * @param sceneNodeId - string of the id of the node selected
   * @returns boolean signifying whether or not the hide items command was executed
   */
  toggleBothVisibility(sceneNodeId: string): boolean {
    const dualOutputNodeId = this.dualOutputService.views.getDualOutputNodeId(sceneNodeId);
    if (!dualOutputNodeId) return false;

    const selectedNodeSelection = this.scene.getSelection(sceneNodeId);
    const dualOutputNodeSelection = this.scene.getSelection(dualOutputNodeId);

    const selectedNodeVisibility = !selectedNodeSelection.isVisible();
    const dualOutputNodeVisibility = !dualOutputNodeSelection.isVisible();

    if (selectedNodeVisibility === dualOutputNodeVisibility) {
      const selection = this.scene.getSelection([sceneNodeId, dualOutputNodeId]);

      this.editorCommandsService.actions.executeCommand(
        'HideItemsCommand',
        selection,
        !selectedNodeVisibility,
      );

      // nodes toggled
      return true;
    }

    // nodes not toggled
    return false;
  }

  get selectiveRecordingEnabled() {
    return this.streamingService.state.selectiveRecording;
  }

  get streamingServiceIdle() {
    return this.streamingService.isIdle;
  }

  get replayBufferActive() {
    return this.streamingService.isReplayBufferActive;
  }

  get selectiveRecordingLocked() {
    return this.replayBufferActive || !this.streamingServiceIdle;
  }

  toggleSelectiveRecording() {
    if (this.selectiveRecordingLocked) return;
    this.streamingService.actions.setSelectiveRecording(
      !this.streamingService.state.selectiveRecording,
    );
    if (!this.selectiveRecordingEnabled && this.isDualOutputActive) {
      this.dualOutputService.actions.toggleDisplay(false, 'vertical');
      this.selectionService.views.globalSelection.filterDualOutputNodes();
    }
  }

  cycleSelectiveRecording(sceneNodeId: string) {
    const selection = this.scene.getSelection(sceneNodeId);

    if (selection.isLocked()) return;
    if (selection.isStreamVisible() && selection.isRecordingVisible()) {
      selection.setRecordingVisible(false);
    } else if (selection.isStreamVisible()) {
      selection.setStreamVisible(false);
      selection.setRecordingVisible(true);
    } else {
      selection.setStreamVisible(true);
      selection.setRecordingVisible(true);
    }
  }

  toggleLock(sceneNodeId: string) {
    const selection = this.createSelection(sceneNodeId);

    const locked = !selection.isLocked();
    selection.setSettings({ locked });
  }

  createSelection(sceneNodeId: string) {
    if (this.dualOutputService.views.hasSceneNodeMaps) {
      /**
       * Toggling the lock applies to both horizontal and vertical scene items
       */
      const otherDisplayNodeId = this.dualOutputService.views.getDualOutputNodeId(sceneNodeId);
      return this.scene.getSelection([sceneNodeId, otherDisplayNodeId] as string[]);
    }
    /**
     * For vanilla scenes, there are no vertical scene items to handle
     */
    return this.scene.getSelection(sceneNodeId);
  }

  get scene() {
    const scene = getDefined(this.scenesService.views.activeScene);
    return scene;
  }
}

function SourceSelector() {
  const { nodeData } = useController(SourceSelectorCtx);
  return (
    <>
      <StudioControls />
      <ItemsTree />
      {nodeData.some(node => node.isFolder) && (
        <HelpTip
          title={$t('Folder Expansion')}
          dismissableKey={EDismissable.SourceSelectorFolders}
          position={{ top: '-8px', left: '102px' }}
        >
          <Translate
            message={$t(
              'Wondering how to expand your folders? Just click on the <icon></icon> icon',
            )}
          >
            <i slot="icon" className="fa fa-folder" />
          </Translate>
        </HelpTip>
      )}
    </>
  );
}

function StudioControls() {
  const {
    sourcesTooltip,
    addGroupTooltip,
    addSourceTooltip,
    selectiveRecordingEnabled,
    selectiveRecordingLocked,
    addSource,
    addFolder,
    toggleSelectiveRecording,
  } = useController(SourceSelectorCtx);

  return (
    <div className={styles.topContainer} data-name="sourcesControls">
      <div className={styles.activeSceneContainer}>
        <Tooltip title={sourcesTooltip} placement="bottomLeft">
          <span className={styles.sourcesHeader}>{$t('Sources')}</span>
        </Tooltip>
      </div>
      <Tooltip title={addSourceTooltip} placement="bottomLeft">
        <i className="icon-add-circle icon-button icon-button--lg" onClick={addSource} />
      </Tooltip>

      <Tooltip title={$t('Toggle Selective Recording')} placement="bottomRight">
        <i
          className={cx('icon-smart-record icon-button icon-button--lg', {
            active: selectiveRecordingEnabled,
            disabled: selectiveRecordingLocked,
          })}
          onClick={toggleSelectiveRecording}
        />
      </Tooltip>
      <Tooltip title={addGroupTooltip} placement="bottomRight">
        <i className="icon-add-folder icon-button icon-button--lg" onClick={addFolder} />
      </Tooltip>
    </div>
  );
}

function ItemsTree() {
  const controller = useController(SourceSelectorCtx);
  const { getTreeData, showContextMenu, makeActive, toggleFolder, handleSort, store } = controller;
  const { showTreeMask, expandedFoldersIds } = store.useState(s => ({
    showTreeMask: s.showTreeMask,
    expandedFoldersIds: s.expandedFoldersIds,
  }));
  const { nodeData, activeItemIds, selectiveRecordingEnabled } = useVuex(() => {
    return {
      nodeData: controller.nodeData,
      activeItemIds: controller.activeItemIds,
      selectiveRecordingEnabled: controller.selectiveRecordingEnabled,
    };
  });
  const setShowTreeMask = useCallback(
    (isShown: boolean) =>
      store.setState(s => {
        s.showTreeMask = isShown;
      }),
    [],
  );

  // Force a rerender when the state of selective recording changes
  const [selectiveRecordingToggled, setSelectiveRecordingToggled] = useState(false);
  useEffect(() => setSelectiveRecordingToggled(!selectiveRecordingToggled), [
    selectiveRecordingEnabled,
  ]);

  const treeData = getTreeData(nodeData);

  return (
    <div
      style={{ height: 'calc(100% - 33px)' }}
      // antd Tree swallows all drag events unless a TreeNode is being dragged.
      // This allows us to drag files into the tree to add them to the scene
      // by persisting a transparent div on top of the tree unless no buttons are
      // being held over it.
      onMouseEnter={(e: React.MouseEvent) => setShowTreeMask(e.buttons !== 0)}
      onMouseUp={() => setShowTreeMask(false)}
      onMouseLeave={() => setShowTreeMask(true)}
    >
      <Scrollable
        className={cx(styles.scenesContainer, styles.sourcesContainer)}
        onContextMenu={(e: React.MouseEvent) => showContextMenu('', e)}
      >
        {showTreeMask && <div className={styles.treeMask} data-name="treeMask" />}
        <Tree
          selectedKeys={activeItemIds}
          expandedKeys={expandedFoldersIds}
          onSelect={(selectedKeys, info) => makeActive(info)}
          onExpand={(selectedKeys, info) => toggleFolder(info.node.key as string)}
          onRightClick={info => showContextMenu(info.node.key as string, info.event)}
          onDrop={handleSort}
          treeData={treeData}
          draggable
          multiple
          blockNode
          showIcon
        />
      </Scrollable>
    </div>
  );
}

const TreeNode = React.forwardRef(
  (
    p: {
      title: string;
      id: string;
      sceneId?: string;
      isLocked: boolean;
      isVisible: boolean;
      isStreamVisible: boolean;
      isRecordingVisible: boolean;
      selectiveRecordingEnabled: boolean;
      isGuestCamActive: boolean;
      isDualOutputActive: boolean;
      canShowActions: boolean;
      hasNodeMap: boolean;
      toggleVisibility: (ev: unknown) => unknown;
      toggleLock: (ev: unknown) => unknown;
      cycleSelectiveRecording: (ev: unknown) => void;
      onDoubleClick: () => void;
      removeSource: () => void;
      sourceProperties: () => void;
    },
    ref: React.RefObject<HTMLDivElement>,
  ) => {
    function selectiveRecordingMetadata() {
      if (p.isStreamVisible && p.isRecordingVisible) {
        return { icon: 'icon-smart-record', tooltip: $t('Visible on both Stream and Recording') };
      }
      return p.isStreamVisible
        ? { icon: 'icon-broadcast', tooltip: $t('Only visible on Stream') }
        : { icon: 'icon-studio', tooltip: $t('Only visible on Recording') };
    }

    const [hoveredIcon, setHoveredIcon] = useState('');

    return (
      <div
        className={styles.sourceTitleContainer}
        data-name={p.title}
        data-role="source"
        ref={ref}
        onDoubleClick={p.onDoubleClick}
      >
        <span className={styles.sourceTitle}>{p.title}</span>
        {p.canShowActions && (
          <>
            {p.isGuestCamActive && <i className="fa fa-signal" />}
            {p.isDualOutputActive && p.hasNodeMap && (
              <DualOutputSourceSelector nodeId={p.id} sceneId={p?.sceneId} />
            )}
            {p.selectiveRecordingEnabled && (
              <Tooltip title={selectiveRecordingMetadata().tooltip} placement="left">
                <i
                  className={cx(selectiveRecordingMetadata().icon, { disabled: p.isLocked })}
                  onClick={p.cycleSelectiveRecording}
                />
              </Tooltip>
            )}
            <i onClick={p.toggleLock} className={p.isLocked ? 'icon-lock' : 'icon-unlock'} />
            <i onClick={p.toggleVisibility} className={p.isVisible ? 'icon-view' : 'icon-hide'} />
          </>
        )}
        <Tooltip
          title={$t('Remove Sources from your Scene.')}
          placement="left"
          visible={hoveredIcon === 'icon-trash'}
        >
          <i
            onClick={p.removeSource}
            className="icon-trash"
            onMouseEnter={() => setHoveredIcon('icon-trash')}
            onMouseLeave={() => setHoveredIcon('')}
          />
        </Tooltip>
        <Tooltip
          title={$t('Open the Source Properties.')}
          placement="left"
          visible={hoveredIcon === 'icon-settings'}
        >
          <i
            onClick={p.sourceProperties}
            className="icon-settings"
            onMouseEnter={() => setHoveredIcon('icon-settings')}
            onMouseLeave={() => setHoveredIcon('')}
          />
        </Tooltip>
      </div>
    );
  },
);

export const SourceSelectorCtx = React.createContext<SourceSelectorController | null>(null);

export default function SourceSelectorElement() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controller = useMemo(() => new SourceSelectorController(), []);
  const { renderElement } = useBaseElement(
    <SourceSelector />,
    { x: 200, y: 120 },
    containerRef.current,
  );

  return (
    <SourceSelectorCtx.Provider value={controller}>
      <div
        ref={containerRef}
        data-name="SourceSelector"
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        {renderElement()}
      </div>
    </SourceSelectorCtx.Provider>
  );
}
