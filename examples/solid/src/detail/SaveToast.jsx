import { Show } from 'solid-js';

export default function SaveToast(props) {
  return (
    <Show when={props.visible}>
      <div class={`alert alert-${props.type} position-fixed bottom-0 end-0 m-3`}>
        {props.message}
      </div>
    </Show>
  );
}
