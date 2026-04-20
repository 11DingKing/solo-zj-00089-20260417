import styled from "@emotion/styled";
import {
  ListNotesDocument,
  ListNotesQuery,
  Note,
  useDeleteNoteMutation,
  useListNotesQuery,
  useUpdateNoteMutation,
} from "../generated/graphql";
import { GENERICS, MIXINS } from "./GlobalStyle";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { FaSortDown, FaSortUp, FaTrash } from "react-icons/fa";
import { ChangeEvent, Fragment, useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { stripHtml } from "string-strip-html";
import { stripText } from "../helper/stripText";

dayjs.extend(relativeTime);

interface EditorProps {
  disabled: boolean;
}

type OrderByType = "ASC" | "DESC";
type SaveStatus = "idle" | "saving" | "saved";

export function ListNotesEditor() {
  const { data, refetch, error } = useListNotesQuery();
  const [noteForm, setNoteForm] = useState({
    title: "",
    content: "",
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [orderBy, setOrderBy] = useState<OrderByType>("DESC");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [submitUpdateNote] = useUpdateNoteMutation();
  const [submitDeleteNote] = useDeleteNoteMutation();

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearAutoSaveTimeout = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = null;
  };

  const clearSaveStatusTimeout = () => {
    if (saveStatusTimeoutRef.current) {
      clearTimeout(saveStatusTimeoutRef.current);
    }
    saveStatusTimeoutRef.current = null;
  };

  const onChangeTitleHandler = (evt: ChangeEvent<HTMLInputElement>) => {
    setNoteForm({ ...noteForm, title: evt.target.value });
    scheduleAutoSave();
  };

  const onChangeEditorHandler = (value: string) => {
    setNoteForm((prevNote) => ({ ...prevNote, content: value }));
    scheduleAutoSave();
  };

  const scheduleAutoSave = () => {
    if (!selectedNote) return;

    clearAutoSaveTimeout();
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveNote();
    }, 3000);
  };

  const handleSaveNote = async () => {
    if (!selectedNote) return;

    clearAutoSaveTimeout();
    setSaveStatus("saving");

    try {
      await submitUpdateNote({
        variables: {
          title: noteForm.title,
          content: noteForm.content,
          noteId: selectedNote.id,
        },
        optimisticResponse: {
          __typename: "Mutation",
          updateNote: {
            __typename: "Note",
            id: selectedNote.id,
            title: noteForm.title,
            content: noteForm.content,
            created_at: selectedNote.created_at,
            updated_at: new Date().toISOString(),
            created_by: {
              __typename: "User",
              id: selectedNote.created_by.id,
              email: selectedNote.created_by.email,
              username: selectedNote.created_by.username,
            },
          },
        },
        update: (cache, { data: mutationData }) => {
          if (!mutationData?.updateNote) return;

          const updatedNote = mutationData.updateNote;

          cache.modify({
            id: cache.identify(updatedNote),
            fields: {
              title: () => updatedNote.title,
              content: () => updatedNote.content,
              updated_at: () => updatedNote.updated_at,
            },
          });

          const currentList = cache.readQuery<ListNotesQuery>({
            query: ListNotesDocument,
          });
          if (currentList && currentList.listNotes) {
            cache.writeQuery({
              query: ListNotesDocument,
              data: {
                listNotes: currentList.listNotes.map((note) => {
                  if (note.id === updatedNote.id) {
                    return updatedNote;
                  }
                  return note;
                }),
              },
            });
          }
        },
      });

      setSaveStatus("saved");
      clearSaveStatusTimeout();
      saveStatusTimeoutRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (error) {
      setSaveStatus("idle");
      console.error(error);
    }
  };

  const onDeleteNoteHandler = (note: Note) => async () => {
    if (window.confirm("Are you sure?")) {
      try {
        await submitDeleteNote({
          variables: {
            noteId: note.id,
          },
          update: (cache) => {
            const noteId = cache.identify({ __typename: "Note", id: note.id });
            if (noteId) {
              cache.evict({ id: noteId });
              cache.gc();
            }

            const currentList = cache.readQuery<ListNotesQuery>({
              query: ListNotesDocument,
            });
            if (currentList && currentList.listNotes) {
              cache.writeQuery({
                query: ListNotesDocument,
                data: {
                  listNotes: currentList.listNotes.filter(
                    (n) => n.id !== note.id,
                  ),
                },
              });
            }
          },
        });

        if (selectedNote?.id === note.id) {
          setSelectedNote(null);
          setNoteForm({ title: "", content: "" });
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  useEffect(() => {
    return () => {
      clearAutoSaveTimeout();
      clearSaveStatusTimeout();
    };
  }, []);

  const onSelectNoteHandler = (note: Note) => () => {
    clearAutoSaveTimeout();
    setNoteForm({
      title: note.title,
      content: note.content,
    });
    setSelectedNote(note);
    setSaveStatus("idle");
  };

  const onClickOrderHandler = async () => {
    const newOrderBy = orderBy === "ASC" ? "DESC" : "ASC";
    await refetch({
      orderBy: newOrderBy,
    });
    setOrderBy(newOrderBy);
  };

  if (error) {
    return (
      <ErrorBoundaryFallback
        message="加载笔记列表失败"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Fragment>
      <ListNotesStyle>
        <h2>All Notes</h2>
        <div className="note-filter">
          <span>{data?.listNotes.length || 0} Notes</span>
          <div className="filters">
            <span onClick={onClickOrderHandler}>
              {orderBy === "DESC" ? <FaSortDown /> : <FaSortUp />}
            </span>
          </div>
        </div>
        <div className="list-notes">
          {data?.listNotes.map((note) => (
            <div
              key={note.id}
              className={`note${selectedNote?.id === note.id ? " active" : ""}`}
              onClick={onSelectNoteHandler(note as any)}
            >
              <div className="note-detail">
                <div className="note-title">{note.title || "Title"}</div>
                <div>
                  {stripText(stripHtml(note.content).result) || "Content"}
                </div>
                <small>{dayjs(note.created_at).fromNow()}</small>
              </div>
              <div
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNoteHandler(note as any)();
                }}
              >
                <FaTrash />
              </div>
            </div>
          ))}
        </div>
      </ListNotesStyle>
      <EditorContainer disabled={!selectedNote}>
        <input
          value={noteForm.title}
          disabled={!selectedNote}
          placeholder="Title"
          onChange={onChangeTitleHandler}
        />
        <div className="save-status">
          {saveStatus === "saving" && <span className="saving">保存中...</span>}
          {saveStatus === "saved" && <span className="saved">已保存</span>}
        </div>
        <ReactQuill
          value={noteForm.content}
          readOnly={!selectedNote}
          placeholder="Start writing here"
          onChange={onChangeEditorHandler}
        />
      </EditorContainer>
    </Fragment>
  );
}

interface ErrorBoundaryFallbackProps {
  message?: string;
  onRetry?: () => void;
}

function ErrorBoundaryFallback({
  message = "发生错误",
  onRetry,
}: ErrorBoundaryFallbackProps) {
  return (
    <ErrorStyled>
      <div className="error-container">
        <h2>出错了</h2>
        <p>{message}</p>
        <div className="error-actions">
          {onRetry && (
            <button className="retry-btn" onClick={onRetry}>
              重试
            </button>
          )}
          <button className="back-btn" onClick={() => window.location.reload()}>
            返回列表
          </button>
        </div>
      </div>
    </ErrorStyled>
  );
}

const ListNotesStyle = styled.div`
  height: 100%;
  width: 100%;
  max-width: 350px;
  color: ${GENERICS.colorBlackCalm};
  background-color: ${GENERICS.bgColor};
  display: flex;
  flex-direction: column;

  > h2 {
    font-weight: normal;
    padding: 20px;
  }

  .note-filter {
    ${MIXINS.va("space-between")}
    padding: 15px 20px;
    border-bottom: 1px solid #ccc;

    .filters span {
      cursor: pointer;
      padding: 3px;
    }
  }

  .list-notes {
    overflow-y: auto;
    height: 100%;

    .active {
      background-color: #fff;
    }
    .note {
      cursor: pointer;
      padding: 20px;
      border-bottom: ${GENERICS.border};
      color: ${GENERICS.colorGray};
      ${MIXINS.va("space-between")}
      &:hover {
        background-color: #eee;
        .delete-btn {
          visibility: visible;
        }
      }

      .note-detail {
        > div {
          margin-bottom: 8px;
        }

        .note-title {
          color: ${GENERICS.colorBlackCalm};
          font-weight: bold;
        }
      }

      .delete-btn {
        visibility: hidden;
        cursor: pointer;
        padding: 5px;
        &:hover {
          transition: 0.3s;
          color: red;
        }
      }
    }
  }
`;

const EditorContainer = styled.div<EditorProps>`
  width: 100%;

  > input {
    border: none;
    outline: none;
    padding: 18px;
    font-size: 2em;
    width: 100%;

    &:disabled {
      background: transparent;
      cursor: not-allowed;
    }
  }

  .save-status {
    padding: 0 18px 10px;
    font-style: italic;

    .saving {
      color: #666;
    }

    .saved {
      color: #4caf50;
    }
  }

  .ql-toolbar,
  .ql-container {
    border: none !important;
  }

  .quill,
  .ql-container {
    font-size: 1em;
    height: 100%;
    cursor: ${(props: any) => (props.disabled ? "not-allowed;" : "unset")};
  }
  .ql-toolbar,
  .ql-editor p {
    cursor: ${(props: any) => (props.disabled ? "not-allowed;" : "unset")};
  }
`;

const ErrorStyled = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${GENERICS.bgColor};

  .error-container {
    text-align: center;
    padding: 40px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    max-width: 400px;

    h2 {
      color: ${GENERICS.colorBlackCalm};
      margin-bottom: 16px;
    }

    p {
      color: ${GENERICS.colorGray};
      margin-bottom: 24px;
    }

    .error-actions {
      display: flex;
      gap: 12px;
      justify-content: center;

      button {
        padding: 10px 20px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;

        &.retry-btn {
          background: ${GENERICS.colorBlackCalm};
          color: white;
          border: none;

          &:hover {
            background: #333;
          }
        }

        &.back-btn {
          background: white;
          color: ${GENERICS.colorBlackCalm};
          border: 1px solid #ccc;

          &:hover {
            background: #f5f5f5;
          }
        }
      }
    }
  }
`;
