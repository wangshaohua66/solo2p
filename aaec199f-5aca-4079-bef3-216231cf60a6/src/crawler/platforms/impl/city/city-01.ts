import { ProvincialPlatformAdapter } from '../provincial';
import { PlatformConfig } from '../../../../types';

export class City01Adapter extends ProvincialPlatformAdapter {
  constructor(config: PlatformConfig) {
    super(config);
  }

  async login(): Promise<boolean> {
    if (!this.config.requiresLogin) {
      return true;
    }
    return super.login();
  }
}
