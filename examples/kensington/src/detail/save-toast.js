import { t } from 'kensington';

export function saveToast(toast) {
  return toast.transform(v => !v ? null :
    t.div({ class: `alert alert-${v.type} position-fixed bottom-0 end-0 m-3` }, v.message),
  );
}
