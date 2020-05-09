import React from 'react';
import './Editor.css';
import { Editor, EditorState, ContentState, ContentBlock, RichUtils, genKey, Modifier } from 'draft-js'
import isSoftNewlineEvent from 'draft-js/lib/isSoftNewlineEvent'

interface EditorProps {
  value: ContentState
  onChange: (value: ContentState) => void
}
export const MyEditor: React.FC<EditorProps> = ({ value, onChange }) => {
  const [state, setState] = React.useState(EditorState.createWithContent(value))

  const prevValue = React.useRef(value)
  const update = (state: EditorState) => {
    setState(state)
    const nextValue = state.getCurrentContent()
    if (prevValue.current !== nextValue) {
      prevValue.current = nextValue
      onChange(nextValue)
    }
  }

  return (
    <div className="Editor">
      <button onClick={() => update(RichUtils.toggleCode(state))}>CODE</button>
      <BlockStyleControls state={state} onToggle={update} />
      <InlineStyleControls state={state} onToggle={update} />
      <Editor editorState={state} onChange={update} onTab={event => {
        const nextState = onTab(event, state)
        if (nextState) {
          update(nextState)
        }
      }} handleReturn={(event, state) => {
        const nextState = handleReturn(event, state)
        if (nextState) {
          update(nextState)
          return 'handled'
        } else {
          return 'not-handled'
        }
      }} />
    </div>
  )
}

const BLOCK_TYPE = {
  H1: 'header-one',
  H2: 'header-two',
  H3: 'header-three',
  H4: 'header-four',
  H5: 'header-five',
  H6: 'header-six',
  UNORDERED_LIST_ITEM: 'unordered-list-item',
  ORDERED_LIST_ITEM: 'ordered-list-item',
  CODE: 'code-block',
  UNSTYLED: 'unstyled',
}

const INLINE_STYLE = {
  BOLD: 'BOLD',
  ITALIC: 'ITALIC',
  UNDERLINE: 'UNDERLINE',
  CODE: 'CODE',
}

const BlockStyleControls: React.FC<{ state: EditorState, onToggle: (state: EditorState) => void }> = ({ state, onToggle }) => {
  const BLOCK_TYPES = [
    { label: 'H1', style: BLOCK_TYPE.H1 },
    { label: 'H2', style: BLOCK_TYPE.H2 },
    { label: 'H3', style: BLOCK_TYPE.H3 },
    { label: 'H4', style: BLOCK_TYPE.H4 },
    { label: 'H5', style: BLOCK_TYPE.H5 },
    { label: 'H6', style: BLOCK_TYPE.H6 },
    { label: 'UL', style: BLOCK_TYPE.UNORDERED_LIST_ITEM },
    { label: 'OL', style: BLOCK_TYPE.ORDERED_LIST_ITEM },
    { label: 'Code Block', style: BLOCK_TYPE.CODE },
  ];

  const selection = state.getSelection();
  const blockType = state
    .getCurrentContent()
    .getBlockForKey(selection.getStartKey())
    .getType();

  return (
    <div>
      {BLOCK_TYPES.map((type) =>
        <StyleButton
          key={type.label}
          active={type.style === blockType}
          label={type.label}
          onClick={() => onToggle(RichUtils.toggleBlockType(state, type.style))}
        />
      )}
    </div>
  );
};


const InlineStyleControls: React.FC<{ state: EditorState, onToggle: (state: EditorState) => void }> = ({ state, onToggle }) => {
  const INLINE_STYLES = [
    { label: 'Bold', style: INLINE_STYLE.BOLD },
    { label: 'Italic', style: INLINE_STYLE.ITALIC },
    { label: 'Underline', style: INLINE_STYLE.UNDERLINE },
    { label: 'Monospace', style: INLINE_STYLE.CODE },
  ];

  const currentStyle = state.getCurrentInlineStyle();

  return (
    <div>
      {INLINE_STYLES.map((type) =>
        <StyleButton
          key={type.label}
          active={currentStyle.has(type.style)}
          label={type.label}
          onClick={() => onToggle(RichUtils.toggleInlineStyle(state, type.style))}
        />
      )}
    </div>
  );
};

const StyleButton: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => {
  return <button onMouseDown={event => event.preventDefault()} onClick={onClick} style={{ color: active ? 'red' : undefined }}>{label}</button>
}

function isListItem(block: ContentBlock): boolean {
  return ['unordered-list-item', 'ordered-list-item'].indexOf(block.getType()) >= 0
}

function onTab(event: React.KeyboardEvent<{}>, state: EditorState): EditorState | undefined {
  const nextState = RichUtils.onTab(event, state, 1);
  return nextState !== state ? nextState : undefined
}

function handleReturn(event: React.KeyboardEvent<{}>, state: EditorState): EditorState | undefined {
  return handleReturnSoftNewline(event, state) ||
  handleReturnEmptyListItem(event, state) ||
  handleReturnSpecialBlock(event, state)
}

// `shift + return` should insert a soft newline.
function handleReturnSoftNewline(event: React.KeyboardEvent<{}>, state: EditorState): EditorState | undefined {
  if (isSoftNewlineEvent(event)) {
    const selection = state.getSelection();
    if (selection.isCollapsed()) {
      return RichUtils.insertSoftNewline(state);
    } else {
      const content = state.getCurrentContent();
      const newContent1 = Modifier.removeRange(content, selection, 'forward');
      const newSelection = newContent1.getSelectionAfter();
      const block = newContent1.getBlockForKey(newSelection.getStartKey());
      const newContent2 = Modifier.insertText(
        newContent1,
        newSelection,
        '\n',
        block.getInlineStyleAt(newSelection.getStartOffset()),
        '',
      );
      return EditorState.push(state, newContent2, 'insert-fragment')
    }
  } else {
    return undefined;
  }
}

// If the cursor is in an empty list item when return is pressed, then the
// block type should change to normal (end the list).
function handleReturnEmptyListItem(_event: React.KeyboardEvent<{}>, state: EditorState): EditorState | undefined {
  const selection = state.getSelection();
  if (selection.isCollapsed()) {
    const contentState = state.getCurrentContent();
    const blockKey = selection.getStartKey();
    const block = contentState.getBlockForKey(blockKey);
    if (isListItem(block) && block.getLength() === 0) {
      const depth = block.getDepth();
      const newState = (depth === 0) ?
        changeBlockType(state, blockKey, BLOCK_TYPE.UNSTYLED) :
        changeBlockDepth(state, blockKey, depth - 1);
      return newState;
    }
  } else {
    return undefined;
  }
}

// If the cursor is at the end of a special block (any block type other than
// normal or list item) when return is pressed, new block should be normal.
function handleReturnSpecialBlock(_event: React.KeyboardEvent<{}>, state: EditorState): EditorState | undefined {
  const selection = state.getSelection();
  if (selection.isCollapsed()) {
    const contentState = state.getCurrentContent();
    const blockKey = selection.getStartKey();
    const block = contentState.getBlockForKey(blockKey);
    if (!isListItem(block) && block.getType() !== BLOCK_TYPE.UNSTYLED) {
      // If cursor is at end.
      if (block.getLength() === selection.getStartOffset()) {
        const newEditorState = insertBlockAfter(
          state,
          blockKey,
          BLOCK_TYPE.UNSTYLED
        );
        return newEditorState
      }
    }
  } else {
    return undefined;
  }
}

function insertBlockAfter(
  state: EditorState,
  blockKey: string,
  newType: string,
): EditorState {
  const content = state.getCurrentContent();
  const blockMap = content.getBlockMap();
  const block = blockMap.get(blockKey);
  const blocksBefore = blockMap.toSeq().takeUntil((v) => (v === block));
  const blocksAfter = blockMap.toSeq().skipUntil((v) => (v === block)).rest();
  const newBlockKey = genKey();
  const newBlock = new ContentBlock({
    key: newBlockKey,
    type: newType,
    text: '',
    characterList: block.getCharacterList().slice(0, 0),
    depth: 0,
  });
  const newBlockMap = blocksBefore.concat(
    [[blockKey, block], [newBlockKey, newBlock]],
    blocksAfter,
  ).toOrderedMap();
  const selection = state.getSelection();
  const newContent = content.merge({
    blockMap: newBlockMap,
    selectionBefore: selection,
    selectionAfter: selection.merge({
      anchorKey: newBlockKey,
      anchorOffset: 0,
      focusKey: newBlockKey,
      focusOffset: 0,
      isBackward: false,
    }),
  }) as ContentState;
  return EditorState.push(state, newContent as any, 'split-block');
}

function changeBlockType(
  editorState: EditorState,
  blockKey: string,
  newType: string,
): EditorState {
  const content = editorState.getCurrentContent();
  const block = content.getBlockForKey(blockKey);
  const type = block.getType();
  if (type !== newType) {
    const newBlock = block.set('type', newType) as ContentBlock;
    const newContent = content.merge({
      blockMap: content.getBlockMap().set(blockKey, newBlock),
    }) as ContentState;
    return EditorState.push(
      editorState,
      newContent,
      'change-block-type'
    );
  } else {
    return editorState;
  }
}

function changeBlockDepth(
  editorState: EditorState,
  blockKey: string,
  newDepth: number,
): EditorState {
  const content = editorState.getCurrentContent();
  const block = content.getBlockForKey(blockKey);
  const depth = block.getDepth();
  if (depth !== newDepth) {
    const newBlock = block.set('depth', newDepth) as ContentBlock;
    const newContent = content.merge({
      blockMap: content.getBlockMap().set(blockKey, newBlock),
    }) as ContentState;
    return EditorState.push(
      editorState,
      newContent,
      'adjust-depth'
    );
  } else {
    return editorState;
  }
}
