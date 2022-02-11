import React from 'react';
import { IWidgetState, useWidget, WidgetModule } from './common/useWidget';
import { WidgetLayout } from './common/WidgetLayout';
import { $t } from '../../services/i18n';
import { TextInput, ColorInput, createBinding, SliderInput } from '../shared/inputs';
import { metadata } from 'components-react/shared/inputs/metadata';

type TGameType = 'tic-tac-toe';

interface ITicTacToeOptions {
  background_color: string;
  border_color: string;
  chat_marker_color: string;
  ai_marker_color: string;
  chat_win_marker_color: string;
  ai_win_marker_color: string;
  chat_won_game_message: string;
  chat_lost_game_message: string;
  draw_game_message: string;
  chat_marker: string;
  ai_marker: string;
  game_ended_message_duration: number;
  chat_turn_message: string;
  ai_turn_message: string;
  cannot_play_here: string;
}

interface IGameWidgetState extends IWidgetState {
  data: {
    settings: {
      decision_poll_timer: number;
      trigger_command: string;
      current_game: TGameType;
      no_input_received_message: string;
      restarting_game_message: string;
      available_games: TGameType[];
      game_options: {
        'tic-tac-toe': ITicTacToeOptions;
      };
    };
  };
}

export function GameWidget() {
  const { isLoading, bind } = useGameWidget();

  return (
    <WidgetLayout>
      {!isLoading && (
        <>
          <SliderInput
            label={$t('Chat Decision Time')}
            {...bind.decision_poll_timer}
            {...metadata.seconds({ min: 1000, max: 10000 })}
          />
          <TextInput label={$t('Trigger Command')} {...bind.trigger_command} />
          <TextInput label={$t('No Input Recieved')} {...bind.no_input_received_message} />
          <TextInput label={$t('Restarting Game')} {...bind.restarting_game_message} />
          <GameOptions game="tic-tac-toe" />
        </>
      )}
    </WidgetLayout>
  );
}

export class GameWidgetModule extends WidgetModule<IGameWidgetState> {
  bind = createBinding(
    () => this.settings,
    statePatch => this.updateSettings(statePatch),
  );
}

function useGameWidget() {
  return useWidget<GameWidgetModule>();
}

function GameOptions(p: { game: TGameType }) {
  const { settings, updateSettings } = useGameWidget();
  const game = p.game;

  function updateGameOption(key: keyof ITicTacToeOptions) {
    return (value: unknown) => {
      updateSettings({ game_options: { [game]: { [key]: value } } });
    };
  }

  return (
    <>
      <ColorInput
        label={$t('Background Color')}
        value={settings.game_options[game].background_color}
        onChange={updateGameOption('background_color')}
      />
      <ColorInput
        label={$t('Border Color')}
        value={settings.game_options[game].border_color}
        onChange={updateGameOption('border_color')}
      />
      <TextInput
        label={$t('Chat Marker')}
        value={settings.game_options[game].chat_marker}
        onChange={updateGameOption('chat_marker')}
      />
      <TextInput
        label={$t("Chat's Turn")}
        value={settings.game_options[game].chat_turn_message}
        onChange={updateGameOption('chat_turn_message')}
      />
      <ColorInput
        label={$t('Chat Marker Color')}
        value={settings.game_options[game].chat_marker_color}
        onChange={updateGameOption('chat_marker_color')}
      />
      <ColorInput
        label={$t('Chat Win Color')}
        value={settings.game_options[game].chat_win_marker_color}
        onChange={updateGameOption('chat_win_marker_color')}
      />
      <TextInput
        label={$t('AI Marker')}
        value={settings.game_options[game].ai_marker}
        onChange={updateGameOption('ai_marker')}
      />
      <TextInput
        label={$t("AI's Turn")}
        value={settings.game_options[game].ai_turn_message}
        onChange={updateGameOption('ai_turn_message')}
      />
      <ColorInput
        label={$t('AI Marker Color')}
        value={settings.game_options[game].ai_marker_color}
        onChange={updateGameOption('ai_marker_color')}
      />
      <ColorInput
        label={$t('AI Win Color')}
        value={settings.game_options[game].ai_win_marker_color}
        onChange={updateGameOption('ai_win_marker_color')}
      />
      <TextInput
        label={$t('Chat Won')}
        value={settings.game_options[game].chat_won_game_message}
        onChange={updateGameOption('chat_won_game_message')}
      />
      <TextInput
        label={$t('Chat Lost')}
        value={settings.game_options[game].chat_lost_game_message}
        onChange={updateGameOption('chat_lost_game_message')}
      />
      <TextInput
        label={$t('Draw Game')}
        value={settings.game_options[game].draw_game_message}
        onChange={updateGameOption('draw_game_message')}
      />
      <TextInput
        label={$t('Cannot Play Here')}
        value={settings.game_options[game].cannot_play_here}
        onChange={updateGameOption('cannot_play_here')}
      />
      <SliderInput
        label={$t('Game End Message Duration')}
        value={settings.game_options[game].game_ended_message_duration}
        onChange={updateGameOption('game_ended_message_duration')}
        {...metadata.seconds({ min: 1000, max: 10000 })}
      />
    </>
  );
}
