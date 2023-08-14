import { Command } from './command';
import { Selection } from 'services/selection';
import { RemoveFolderCommand } from './remove-folder';
import { RemoveItemCommand } from './remove-item';
import { DualOutputService } from 'services/dual-output';
import { SceneCollectionsService } from 'services/scene-collections';
import { $t } from 'services/i18n';
import { Inject } from 'services/core';

/**
 * Removes scene item nodes
 *
 * @remarks
 * This leverages the remove folder and remove item editor commands.
 * For dual output scenes, remove both the horizontal and vertical nodes
 * and remove the scene node map entry.
 *
 * @param selection - The selection of nodes
 */
export class RemoveNodesCommand extends Command {
  private removeFolderSubCommands: RemoveFolderCommand[];
  private removeItemSubCommands: RemoveItemCommand[];
  @Inject() dualOutputService: DualOutputService;
  @Inject() sceneCollectionsService: SceneCollectionsService;

  private selectionName: string;
  private nodeOrder: string[];
  private nodeMapEntries: Dictionary<string>;

  constructor(private selection: Selection) {
    super();
    this.selection.freeze();
    this.selectionName = this.selection.getNodes()[0].name;
  }

  get description() {
    return $t('Remove %{sourceName}', { sourceName: this.selectionName });
  }

  async execute() {
    this.removeFolderSubCommands = [];
    this.removeItemSubCommands = [];

    this.nodeOrder = this.selection.getScene().getNodesIds();

    const hasNodeMap = this.dualOutputService.views.hasNodeMap(this.selection.sceneId);

    this.selection.getFolders().forEach(folder => {
      if (hasNodeMap && this.dualOutputService.views.getVerticalNodeId(folder.id)) {
        console.log(
          'folder vertical node id ',
          this.dualOutputService.views.getVerticalNodeId(folder.id),
        );
        // save node map entries to restore them when rolling back
        // to prevent duplicates, only save when encountering a horizontal node

        this.nodeMapEntries = {
          ...this.nodeMapEntries,
          [folder.id]: this.dualOutputService.views.getVerticalNodeId(folder.id),
        };

        this.sceneCollectionsService.removeNodeMapEntry(this.selection.sceneId, folder.id);
      }

      const subCommand = new RemoveFolderCommand(this.selection.sceneId, folder.id);
      subCommand.execute();
      this.removeFolderSubCommands.push(subCommand);
    });

    for (const item of this.selection.getItems()) {
      if (hasNodeMap && this.dualOutputService.views.getVerticalNodeId(item.id)) {
        // save node map entries to restore them when rolling back
        // to prevent duplicates, only save when encountering a horizontal node
        this.nodeMapEntries = {
          ...this.nodeMapEntries,
          [item.id]: this.dualOutputService.views.getVerticalNodeId(item.id),
        };
        this.sceneCollectionsService.removeNodeMapEntry(this.selection.sceneId, item.id);
      }
      // if (hasNodeMap && item?.display === 'vertical') {
      //   const horizontalNodeId = this.dualOutputService.views.getHorizontalNodeId(item.id);
      //   console.log('item horizontal node id', item?.id);
      //   console.log('item vertical node id ', horizontalNodeId);
      //   // save node map entries to restore them when rolling back
      //   // to prevent duplicates, only save when encountering a horizontal node

      //   this.nodeMapEntries = {
      //     ...this.nodeMapEntries,
      //     [horizontalNodeId]: item.id,
      //   };

      //   const verticalSubCommand = new RemoveItemCommand(horizontalNodeId);
      //   await verticalSubCommand.execute();
      //   this.removeItemSubCommands.push(verticalSubCommand);

      //   this.sceneCollectionsService.removeNodeMapEntry(this.selection.sceneId, horizontalNodeId);
      // }
      const subCommand = new RemoveItemCommand(item.id);
      await subCommand.execute();
      this.removeItemSubCommands.push(subCommand);
    }
  }

  async rollback() {
    for (const itemCommand of [...this.removeItemSubCommands].reverse()) {
      await itemCommand.rollback();
    }

    [...this.removeFolderSubCommands].reverse().forEach(cmd => cmd.rollback());

    this.selection.getScene().setNodesOrder(this.nodeOrder);

    // restore node map for dual output scenes
    if (this.nodeMapEntries) {
      const sceneId = this.selection.sceneId;

      Object.keys(this.nodeMapEntries).forEach(horizontalNodeId => {
        this.sceneCollectionsService.createNodeMapEntry(
          sceneId,
          horizontalNodeId,
          this.nodeMapEntries[horizontalNodeId],
        );
      });
    }
  }
}
