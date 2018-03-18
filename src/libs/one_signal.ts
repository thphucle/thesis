import * as config from "./config";
import Request from "./request";

const url = "https://onesignal.com/api/v1/notifications";
const app_id = config.one_signal && config.one_signal.app_id || null;
const rest_key = config.one_signal && config.one_signal.rest_key || null;
const request = new Request({
    headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${rest_key}`
    }
});

export default {
    send(data) {
        return request.post(url, Object.assign({}, data, {
            app_id: app_id
        }));
    },
    sendTo(registrationToken: string, payload) {
        return this.send(Object.assign({}, payload, {
            include_player_ids: [registrationToken]
        }));
    },
    sendAll(payload) {
        return this.send(Object.assign({}, payload, {
            included_segments: ["All"]
        }))
    },
    broadcast(registrationTokens: [string], payload) {
        return this.send(Object.assign({}, payload, {
            include_player_ids: registrationTokens
        }));
    },
    sendToGroup(groupName: string, payload) {
        return this.send(Object.assign({}, payload, {
            included_segments: [groupName]
        }))
    },
    broadcastGroup(groupNames: [string], payload) {
        return this.send(Object.assign({}, payload, {
            included_segments: groupNames
        }));
    },
    sendToCondition(conditions: [any], payload) {
        return this.send(Object.assign({}, payload, {
            filters: conditions
        }));
    }
}