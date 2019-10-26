import * as assert from 'assert';
import { format } from './format.test';
import { workspace } from 'vscode';

const expectedResult = `d = [
  30_644_250_780,
  9_003_106_878,
  30_636_278_846,
  66_641_217_692,
  4_501_790_980,
  671_24_603036,
  131_61973916,
  66_606629_920,
  30_642_677_916,
  30_643_069_058
]
a, s = [], $*[0]
s.each_byte { |b| a << ('%036b' % d[b.chr.to_i]).scan(/\\d{6}/) }
a.transpose.each do |a|
  a.join.each_byte { |i| print i == 49 ? ($*[1] || '#') : 32.chr }
  puts
end
`;

const workspaceFolder = workspace.workspaceFolders![5].uri;

suite('Test Ruby', () => {
  test('it formats Ruby', () => {
    return format('ruby.rb', workspaceFolder).then(({ result }) => {
      assert.strictEqual(result, expectedResult);
    });
  });
});
