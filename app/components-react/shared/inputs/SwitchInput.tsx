import { Form, Switch } from 'antd';
import React from 'react';
import { InputComponent, TSlobsInputProps, useInput, ValuesOf } from './inputs';
import InputWrapper from './InputWrapper';
import { SwitchProps } from 'antd/lib/switch';
import styles from './SwitchInput.module.less';
import cx from 'classnames';

// select which features from the antd lib we are going to use
const ANT_SWITCH_FEATURES = ['checkedChildren', 'unCheckedChildren'] as const;

export type TSwitchInputProps = TSlobsInputProps<
  { inputRef?: React.Ref<HTMLInputElement>; style?: React.CSSProperties; name?: string },
  boolean,
  SwitchProps,
  ValuesOf<typeof ANT_SWITCH_FEATURES>
>;

export const SwitchInput = InputComponent((p: TSwitchInputProps) => {
  const { wrapperAttrs, inputAttrs } = useInput('switch', p, ANT_SWITCH_FEATURES);

  /*
   * The horizontal styling shifts the label to follow the switch.
   */
  return wrapperAttrs?.layout === 'horizontal' ? (
    <InputWrapper {...{ wrapperAttrs, nowrap: true }}>
      <Form.Item colon={false} aria-label={p.label} style={p.style}>
        <Switch
          checked={inputAttrs.value}
          size="small"
          {...inputAttrs}
          ref={p.inputRef}
          className={cx(styles.horizontal, styles.horizontalItem)}
          checkedChildren={<i className="check-mark" />}
        />
        {p.label}
      </Form.Item>
    </InputWrapper>
  ) : (
    <InputWrapper {...wrapperAttrs}>
      <Switch checked={inputAttrs.value} size="small" {...inputAttrs} ref={p.inputRef} />
    </InputWrapper>
  );
});
