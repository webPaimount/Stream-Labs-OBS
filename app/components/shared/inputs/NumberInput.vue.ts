import { Component, Prop } from 'vue-property-decorator';
import { BaseInput } from './BaseInput';
import { INumberMetadata } from './index';

@Component({})
export default class NumberInput extends BaseInput<number|string, INumberMetadata> {

  @Prop()
  value: number | string; // the string type is for empty field

  @Prop()
  metadata: INumberMetadata;

  emitInput(eventData: string, event?: any) {
    if (!isNaN(parseFloat(eventData))) {
      // if is a string of valid number
      // convert to number
      super.emitInput(parseFloat(eventData), event);
      return;
    }
    super.emitInput(eventData, event);
  }

  getValidations() {
    return {
      ...super.getValidations(),
      max_value: this.options.max,
      min_value: this.options.min,
    };
  }
}
