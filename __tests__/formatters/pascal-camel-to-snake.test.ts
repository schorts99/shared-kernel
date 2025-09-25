import { PascalCamelToSnake } from "../../src/formatters";

describe('PascalCamelToSnake', () => {
  describe('.format', () => {
    it('should return a pascal case to snake case', () => {
      const resultID = PascalCamelToSnake.format("ID");
      const resultExampleDAO = PascalCamelToSnake.format("ExampleDAO");

      expect(resultID).toEqual("id");
      expect(resultExampleDAO).toEqual("example_dao");
    });

    it('should return a camel case to snake case', () => {
      const resultAlgoClass = PascalCamelToSnake.format("algoClass");

      expect(resultAlgoClass).toEqual("algo_class");
    });
  });
});
