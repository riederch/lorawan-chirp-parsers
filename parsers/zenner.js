
/**
 * based on https://github.com/studierendenwerk-ulm/payload-decoder-zenner-easy-protect-radio-lora
 *
 * @public
 *
 * @param input {
 *     bytes: "Byte array containing the uplink payload, e.g. [255, 230, 255, 0]"
 *     fPort: "Uplink fPort."
 *     variables: "Object containing the configured device variables."
 * }
 *
 * @return { data: "Object representing the decoded payload." }
 */
function decodeUplink(input) {
    let bytes = input.bytes;
    let port = input.fPort;

    if (bytes === null || bytes === 0) {
        return {
            data: {
                status_dedcoded: false
            },
            warnings: [],
            errors: []
        };
    }

    const TYPE_SP1 = 0x1; //sent daily -> packet, max. 2 retransmissions
    const TYPE_SP4 = 0x4; // todo implement
    const TYPE_SP9 = 0x9; // Sent immediately after first  activation and from then on every 6 months -> No retransmissions
    const SUBTYPE_SP9_1 = 0x01; // sent every month except the month of first activation -> No retransmissions
    const SUBTYPE_SP9_2 = 0x02; // sent immediately after first activation and from then on every 6 months -> No retransmissions
    const SUBTYPE_SP9_3 = 0x03;
    const TYPE_AP1 = 0xA; //  (status code, status data): event based -> Max 5 AP packets per month, no retransmissions

    // Device specific status summary definition
    const A_REMOVAL = 0x02;
    const A_BATTERY_END_OF_LIFE = 0x0C;
    const A_HORN_DRIVE_LEVEL_FAILURE = 0x16;
    const A_OBSTRUCTION_DETECTION = 0x1A;
    const A_OBJECT_IN_THE_SURROUNDING_AREA = 0x1C;
    const AP_VALUES = [
        "removal",
        "battery end of life",
        "horn drive level failure",
        "obstruction detection",
        "object in the surrounding area"
    ];
    const S_STATUS_SUMMARY_VALUES = [
        "removal",
        "0",
        "battery end of life",
        "acoustic alarm failure",
        "obstruction detection",
        "surrounding area monitoring"
    ];


    let returnObject = {
        port: port,
        packet_type: bytes[0] >> 4,
        packet_subtype: bytes[0] & 0x0F,
        packet_type_info: null,
        status_interpretation: null,
    };

    switch (returnObject.packet_type) {
        case TYPE_SP1:
            returnObject.packet_type_info = "synchronous";
            returnObject.status_interpretation = {
                day_value: get4ByteValue(1, bytes),
            };
            break;
        case TYPE_SP4:
            returnObject.packet_type_info = "synchronous";
            returnObject.status_interpretation = {
                date: (bytes[2]).toString(16) + '.' + +(bytes[1]).toString(16) + '.',
                key_value: get4ByteValue(3, bytes),
                summary: (((bytes[8] << 8) + (bytes[7])).toString(16)).toUpperCase(),
                reserved: (((bytes[10] << 8) + (bytes[9])).toString(16)).toUpperCase(),
            };
            break;
        case TYPE_SP9:
            returnObject.packet_type_info = "synchronous";
            switch (returnObject.packet_subtype) {
                case SUBTYPE_SP9_1:
                    returnObject.status_interpretation = {
                        dateTime: decodeDateAndTime((bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | (bytes[4])),
                        summary: buildStatusSummary(bytes[5], bytes[6], S_STATUS_SUMMARY_VALUES)
                    };
                    break;
                case SUBTYPE_SP9_2:
                    returnObject.status_interpretation = {
                        firmware_version: (bytes[4]).toString(16) + '.' + (bytes[3]).toString(16) + '.' + (bytes[2]).toString(16) + '.' + (bytes[1]).toString(16),
                        LoRa_WAN_version: (bytes[7]).toString(16) + "." + (bytes[6]).toString(16) + "." + (bytes[5]).toString(16),
                        LoRa_command_version: (bytes[9]).toString(16) + "." + (bytes[8]).toString(16),
                        device_type: (bytes[10]).toString(16),
                        meter_ID: (((bytes[14] << 24) + (bytes[13] << 16) + (bytes[12] << 8) + (bytes[11])).toString(16)).toUpperCase(),
                        reserved: (((bytes[18] << 8) + (bytes[17])).toString(16)).toUpperCase()
                    };
                    break;
                case SUBTYPE_SP9_3:
                    returnObject.status_interpretation = {
                        channel: (bytes[1]).toString(16),
                        fabrication_number: (((bytes[5] << 24) + (bytes[4] << 16) + (bytes[3] << 8) + (bytes[2])).toString(16)).toUpperCase(),
                        manufacturer: (bytes[7]).toString(16) + "." + (bytes[6]).toString(16),
                        fabrication_block: (bytes[8]).toString(16),
                        device_medium: (bytes[9]).toString(16),
                        obis: (bytes[10]).toString(16),
                        vif_vife: (((bytes[13] << 16) + (bytes[12] << 8) + (bytes[11])).toString(16)).toUpperCase(),
                        reserved: (((bytes[16] << 16) + (bytes[15] << 8) + (bytes[14])).toString(16)).toUpperCase(),
                    };
                    break;
                default:
                    break;
            }

            break;
        case TYPE_AP1:
            returnObject.packet_type_info = "asynchronous";
            returnObject.date = (decodeDate(bytes [3] << 8 | bytes[4]));
            switch (bytes[1]) {
                case A_REMOVAL:
                    returnObject.status_interpretation = AP_VALUES[0];
                    break;
                case A_BATTERY_END_OF_LIFE:
                    returnObject.status_interpretation = AP_VALUES[1];
                    break;
                case A_HORN_DRIVE_LEVEL_FAILURE:
                    returnObject.status_interpretation = AP_VALUES[2];
                    break;
                case A_OBSTRUCTION_DETECTION:
                    returnObject.status_interpretation = AP_VALUES[3];
                    break;
                case A_OBJECT_IN_THE_SURROUNDING_AREA:
                    returnObject.status_interpretation = AP_VALUES[4];
                    break;
                default:
                    break;
            }

            break;
        default:
            break;
    }

    return {
        data: returnObject,
        warnings: [],
        errors: []
    };
}

/**
 * @public
 *
 * @param input {
 *     data: "Object representing the payload that must be encoded."
 *     variables: "Object containing the configured device variables."
 * }
 *
 * @return { bytes: "Byte array containing the downlink payload." }
 */
function encodeDownlink(input) {
    return {
        bytes: []
    };
}

/**
 * @private
 *
 * decodes date (EN13757-3:2013, Annex A, data type G).
 * input: int, lower two bytes interpreted.
 * output: date string YYYY-MM-DD.
 * @param bytes
 * @returns {string}
 */
function decodeDate(bytes) {
    //TODO Handling errors with 0xFF see LoRa radio packet definitions page 15
    let day = (bytes & 0x1F00) >> 8;
    let month = (bytes & 0x000F);
    let year = ((bytes & 0xE000) >> 10) | ((bytes & 0x00F0) >> 4);

    return "20" + year.toString() + "-" + month.toString() + "-" + day.toString();
}

/**
 * @private
 *
 * Date and time format.
 * Date&Time stamp coding according to EN13757-3:2013, Annex A, data type F
 * @param bytes
 * @returns {string}
 */
function decodeDateAndTime(bytes) {
    let minute = (bytes & 0x3F000000) >> 24;
    let hour = (bytes & 0x001F0000) >> 16;
    let day = (bytes & 0x00001F00) >> 8;
    let month = (bytes & 0x0000000F);
    let year = ((bytes & 0x0000E000) >> 10) | ((bytes & 0x000000F0) >> 4);

    //TODO make a function to check is the device in correct dateAndTime

    return "20" + ("0" + year).slice(-2) + "-"
        + ("0" + month).slice(-2) + "-"
        + ("0" + day).slice(-2) + "T"
        + ("0" + hour).slice(-2) + ":"
        + ("0" + minute).slice(-2)
        + ":00Z";
}

/**
 * @private
 *
 * @param start
 * @param bytes
 * @returns {string}
 */
function get4ByteValue(start, bytes) {
    return (bytes[start + 3] << 24)
        + (bytes[start + 2] << 16)
        + (bytes[start + 1] << 8)
        + (bytes[start]);
}

/**
 * @private
 *
 * Build the summary for package 9.1.
 * @param a
 * @param b
 * @param S_STATUS_SUMMARY_VALUES
 * @returns {[]}
 */
function buildStatusSummary(a, b, S_STATUS_SUMMARY_VALUES) {

    let bin1 = parseInt(a.toString(), 16).toString(2);
    let bin2 = parseInt(b.toString(), 16).toString(2);
    let result = [];

    for (let i = 0; i < bin1.length; i++) {
        if (bin1[i] === "1") {
            result.push(S_STATUS_SUMMARY_VALUES[i]);
        }

        for (let j = 0; j < bin2.length; j++) {
            if (bin2[i] === "1") {
                result.push(S_STATUS_SUMMARY_VALUES[j]);
            }
        }
    }

    return result;
}
