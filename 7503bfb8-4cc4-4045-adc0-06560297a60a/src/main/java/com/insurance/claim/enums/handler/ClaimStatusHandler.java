package com.insurance.claim.enums.handler;

import com.insurance.claim.enums.ClaimStatus;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class ClaimStatusHandler extends BaseTypeHandler<ClaimStatus> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, ClaimStatus parameter, JdbcType jdbcType) throws SQLException {
        ps.setInt(i, parameter.getCode());
    }

    @Override
    public ClaimStatus getNullableResult(ResultSet rs, String columnName) throws SQLException {
        int code = rs.getInt(columnName);
        if (rs.wasNull()) {
            return null;
        }
        return ClaimStatus.fromCode(code);
    }

    @Override
    public ClaimStatus getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        int code = rs.getInt(columnIndex);
        if (rs.wasNull()) {
            return null;
        }
        return ClaimStatus.fromCode(code);
    }

    @Override
    public ClaimStatus getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        int code = cs.getInt(columnIndex);
        if (cs.wasNull()) {
            return null;
        }
        return ClaimStatus.fromCode(code);
    }
}
