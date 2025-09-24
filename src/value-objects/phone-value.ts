import { ValueObject } from "./";

const REGEX = /\+(9[976]\d|8[987530]\d|6[987]\d|5[90]\d|42\d|3[875]\d|2[98654321]\d|9[8543210]|8[6421]|6[6543210]|5[87654321]|4[987654310]|3[9643210]|2[70]|7|1)\d{10,12}$/;

export abstract class PhoneValue implements ValueObject {
  readonly valueType = "Phone";
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  get isValid(): boolean {
    return REGEX.test(this.value); 
  }

  get countryCode(): string | null {
    if (this.isValid) {
      const countryCodeLength = this.value.length - 10;

      return this.value.slice(0, countryCodeLength);
    }

    return null;
  }

  get phoneNumber(): string | null {
    if (this.isValid) {
      return this.value.slice(-10);
    }

    return null;
  }

  get formattedPhone(): string | null {
    if (this.isValid) {
      const phoneNumber = this.phoneNumber!.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    
      return `${this.countryCode} ${phoneNumber}`;
    }

    return null;
  }

  abstract readonly attributeName: string;
}
