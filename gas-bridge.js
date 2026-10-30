/**
 * gas-bridge.js
 * ============================================================
 * google.script.run → fetch(POST, GAS exec URL) 변환 브리지
 * 22. 등대의집 홈페이지(메타버스) — GitHub Pages 프론트 전용
 * ============================================================
 */
(function () {
  'use strict';

  const GAS_URL = 'https://script.google.com/macros/s/AKfycbzd6I2JFN_xcS4YCl-JkkfVa7JIPgmBrkLmW1q3SbsolUhI4Wf93vaqaTGtn5PfuaJY/exec';

  // 공개 읽기 데이터는 파이어스토어 복사본(구글 시트 동기화)에서 먼저 읽고, 실패하면 GAS 호출로 자동 전환한다.
  const FS_BASE = 'https://firestore.googleapis.com/v1/projects/lighthouse-metaverse/databases/(default)/documents/cache/';
  const FS_FUNCS = ['getLandingData', 'getMetaverseData', 'getNoticeList', 'getGalleryImages', 'getNewsletterList',
    'getAboutUsList', 'getProgramsList', 'getHallOfFameList', 'getPopupBannerList', 'getMetaverseNoticeList', 'getAgencyLinks'];

  function callFirestore(fn) {
    const ctl = ('AbortController' in window) ? new AbortController() : null;
    const timer = ctl ? setTimeout(function () { ctl.abort(); }, 3000) : null;
    return fetch(FS_BASE + encodeURIComponent(fn), ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('Firestore ' + r.status); return r.json(); })
      .then(function (d) {
        if (timer) clearTimeout(timer);
        const j = d && d.fields && d.fields.json && d.fields.json.stringValue;
        if (typeof j !== 'string') throw new Error('Firestore 문서 형식 오류');
        return JSON.parse(j);
      }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  function callGas(prop, args, successCb, failureCb) {
    fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: prop, args: args })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (successCb) successCb(data);
      })
      .catch(function (err) {
        console.error('[GAS Bridge] Error calling ' + prop + ':', err);
        if (failureCb) failureCb(err);
      });
  }

  /**
   * google.script.run 호환 프록시 생성
   * 사용 패턴:
   *   google.script.run
   *     .withSuccessHandler(cb)
   *     .withFailureHandler(errCb)
   *     .함수명(인자...);
   */
  function createRunnerProxy(successCb, failureCb) {
    return new Proxy({}, {
      get(_, prop) {
        // 체이닝 메서드
        if (prop === 'withSuccessHandler') {
          return (cb) => createRunnerProxy(cb, failureCb);
        }
        if (prop === 'withFailureHandler') {
          return (cb) => createRunnerProxy(successCb, cb);
        }

        // GAS 함수 실제 호출 → POST 요청으로 변환
        return function (...args) {
          if (FS_FUNCS.indexOf(prop) !== -1) {
            callFirestore(prop).then(
              function (result) { if (successCb) successCb(result); },
              function () { callGas(prop, args, successCb, failureCb); }
            );
            return;
          }
          callGas(prop, args, successCb, failureCb);
        };
      }
    });
  }

  // window.google.script.run 을 프록시로 정의
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  Object.defineProperty(window.google.script, 'run', {
    get: function () {
      return createRunnerProxy(null, null);
    },
    configurable: true
  });

  console.log('[GAS Bridge] google.script.run 브리지 초기화 완료 ->', GAS_URL);
})();